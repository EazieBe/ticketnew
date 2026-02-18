import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent, Chip, Avatar,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  CircularProgress, List, ListItem, ListItemText, ListItemAvatar, Divider,
  FormControlLabel, Switch
} from '@mui/material';
import {
  Send, Edit, Delete, Person, Comment, Visibility, VisibilityOff
} from '@mui/icons-material';
import { useAuth } from '../AuthContext';
import { useToast } from '../contexts/ToastContext';
import useApi from '../hooks/useApi';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { getBestTimestamp } from '../utils/timezone';
import { TimestampDisplay } from './TimestampDisplay';
import { sanitizeInput } from '../utils/security';

dayjs.extend(relativeTime);

function TicketComments({ ticketId, onCommentUpdate, isDeleting = false }) {
  const { user } = useAuth();
  const api = useApi();
  const { success } = useToast();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [editingComment, setEditingComment] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    comment: '',
    is_internal: false
  });

  const fetchComments = useCallback(async (showLoading = true) => {
    // Don't fetch if component is unmounted
    if (!isMountedRef.current) {
      console.log('Component unmounted, skipping comment fetch');
      return;
    }
    
    // Don't fetch if ticket is being deleted
    if (isDeleting) {
      console.log('Ticket is being deleted, skipping comment fetch');
      return;
    }
    
    // No localStorage checks - just fetch directly from server
    
    try {
      if (showLoading && initialLoad) {
        setLoading(true);
      }
      setError(null);
      const response = await api.get(`/tickets/${ticketId}/comments`);
      // Only update state if component is still mounted
      if (isMountedRef.current) {
        setComments(response || []);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      // Check if the error is a 404 (ticket not found) and silently handle it
      if (err.response?.status === 404 || 
          err.message?.includes('404') || 
          err.message?.includes('Not Found') ||
          err.message?.includes('Ticket not found')) {
        if (isMountedRef.current) {
          setComments([]);
          setError(null); // Don't show error for missing ticket
        }
        console.log('Ticket not found, clearing comments silently');
      } else {
        if (isMountedRef.current) {
          setError(typeof err === 'string' ? err : err.message || 'Failed to load comments');
          setComments([]);
        }
      }
    } finally {
      if (showLoading && initialLoad && isMountedRef.current) {
        setLoading(false);
        setInitialLoad(false);
      }
    }
  }, [api, ticketId, initialLoad, isDeleting]);

  useEffect(() => {
    // Don't fetch if ticket is being deleted
    if (!isDeleting) {
      fetchComments();
    }
  }, [fetchComments, isDeleting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      // Clear any pending state when component unmounts
      setComments([]);
      setError(null);
      setLoading(false);
    };
  }, []);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || submitting) return;

    try {
      setSubmitting(true);
      const commentData = {
        comment: newComment.trim(),
        is_internal: isInternal
      };

      await api.post(`/tickets/${ticketId}/comments/`, commentData);
      
      setNewComment('');
      setIsInternal(false);
      fetchComments(false); // Don't show loading spinner when refreshing
      
      if (onCommentUpdate) onCommentUpdate();
      success('Comment added successfully');
    } catch (err) {
      console.error('Error adding comment:', err);
      setError(typeof err === 'string' ? err : err.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async () => {
    if (!editFormData.comment.trim()) return;

    try {
      await api.put(`/tickets/${ticketId}/comments/${editingComment.comment_id}`, {
        comment: editFormData.comment.trim(),
        is_internal: editFormData.is_internal
      });

      setEditDialogOpen(false);
      setEditingComment(null);
      setEditFormData({ comment: '', is_internal: false });
      fetchComments(false); // Don't show loading spinner
      
      if (onCommentUpdate) onCommentUpdate();
      success('Comment updated successfully');
    } catch (err) {
      console.error('Error updating comment:', err);
      setError('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;

    try {
      await api.delete(`/tickets/${ticketId}/comments/${commentId}`);
      fetchComments(false); // Don't show loading spinner
      
      if (onCommentUpdate) onCommentUpdate();
      success('Comment deleted successfully');
    } catch (err) {
      console.error('Error deleting comment:', err);
      setError('Failed to delete comment');
    }
  };

  const openEditDialog = (comment) => {
    setEditingComment(comment);
    setEditFormData({
      comment: comment.comment,
      is_internal: comment.is_internal
    });
    setEditDialogOpen(true);
  };

  const canEditComment = (comment) => {
    return user?.user_id === comment.user_id || user?.role === 'admin' || user?.role === 'dispatcher';
  };

  const canDeleteComment = (comment) => {
    return user?.user_id === comment.user_id || user?.role === 'admin';
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {typeof error === 'string' ? error : 'An error occurred while loading comments'}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Comment color="primary" />
            Comments ({comments.length})
          </Typography>

          {/* Add New Comment */}
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Add a comment"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Type your comment here..."
              sx={{ mb: 2 }}
            />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {isInternal ? <VisibilityOff /> : <Visibility />}
                    {isInternal ? 'Internal Note' : 'Customer Visible'}
                  </Box>
                }
              />
              
              <Button
                variant="contained"
                startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <Send />}
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || submitting}
              >
                {submitting ? 'Adding...' : 'Add Comment'}
              </Button>
            </Box>
          </Box>

          <Divider sx={{ mb: 2 }} />

          {/* Comments List */}
          <Box sx={{ minHeight: '200px' }}>
            {loading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : comments.length === 0 ? (
              <Typography color="text.secondary" textAlign="center" py={3}>
                No comments yet
              </Typography>
            ) : (
              <List>
              {comments.map((comment, index) => (
                <React.Fragment key={comment.comment_id}>
                  <ListItem alignItems="flex-start">
                    <ListItemAvatar>
                      <Avatar>
                        <Person />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {comment.user?.name || 'Unknown User'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            <TimestampDisplay 
                              entity={comment} 
                              entityType="comments" 
                              format="relative"
                              variant="caption"
                            />
                          </Typography>
                          {comment.is_internal && (
                            <Chip
                              icon={<VisibilityOff />}
                              label="Internal"
                              size="small"
                              color="warning"
                            />
                          )}
                          {comment.updated_at && comment.updated_at !== getBestTimestamp(comment, 'comments') && (
                            <Chip
                              label="Edited"
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Typography
                          component="span"
                          variant="body2"
                          color="text.primary"
                          sx={{ whiteSpace: 'pre-wrap' }}
                        >
                          {sanitizeInput(comment.comment)}
                        </Typography>
                      }
                    />
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      {canEditComment(comment) && (
                        <IconButton
                          size="small"
                          onClick={() => openEditDialog(comment)}
                        >
                          <Edit />
                        </IconButton>
                      )}
                      {canDeleteComment(comment) && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteComment(comment.comment_id)}
                        >
                          <Delete />
                        </IconButton>
                      )}
                    </Box>
                  </ListItem>
                  {index < comments.length - 1 && <Divider variant="inset" component="li" />}
                </React.Fragment>
              ))}
            </List>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Edit Comment Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Comment</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Comment"
            value={editFormData.comment}
            onChange={(e) => setEditFormData({ ...editFormData, comment: e.target.value })}
            sx={{ mt: 1 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={editFormData.is_internal}
                onChange={(e) => setEditFormData({ ...editFormData, is_internal: e.target.checked })}
              />
            }
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {editFormData.is_internal ? <VisibilityOff /> : <Visibility />}
                {editFormData.is_internal ? 'Internal Note' : 'Customer Visible'}
              </Box>
            }
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleEditComment} variant="contained">
            Update Comment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TicketComments; 