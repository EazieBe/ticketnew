"""
Distributed rate limiting using Redis.
Falls back to in-memory when Redis is unavailable (per-process).
"""
import logging
import time

from fastapi import HTTPException, Request

logger = logging.getLogger("ticketing")

_redis_client = None
_memory_fallback = {}


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        from settings import settings
        import redis
        _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        _redis_client.ping()
        logger.info("Redis connected for rate limiting")
        return _redis_client
    except Exception as e:
        logger.warning("Redis unavailable for rate limiting: %s", e)
        _redis_client = None
        return None


def _check_limit(key: str, limit: int, window_seconds: int) -> bool:
    """True if allowed, False if rate limited."""
    r = _get_redis()
    if not r:
        return _memory_check(key, limit, window_seconds)
    now = int(time.time())
    window_key = f"ratelimit:{key}:{now // window_seconds}"
    try:
        pipe = r.pipeline()
        pipe.incr(window_key)
        pipe.expire(window_key, window_seconds + 1)
        count, _ = pipe.execute()
        return count <= limit
    except Exception as e:
        logger.warning("Redis rate limit error: %s", e)
        return True


def _memory_check(key: str, limit: int, window_seconds: int) -> bool:
    now = int(time.time())
    window = now // window_seconds
    bucket_key = f"{key}:{window}"
    count = _memory_fallback.get(bucket_key, 0)
    if count >= limit:
        return False
    _memory_fallback[bucket_key] = count + 1
    return True


def rate_limit_public(key_prefix: str, limit: int = 10, window_seconds: int = 60):
    """Rate limit by client IP. Use for login, refresh."""
    def _limiter(request: Request):
        client_ip = getattr(request.client, "host", "unknown")
        key = f"{key_prefix}:{client_ip}"
        if not _check_limit(key, limit, window_seconds):
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
    return _limiter
