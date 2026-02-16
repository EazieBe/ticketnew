"""Field tech companies: one address per company, techs listed under company."""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import csv
import io

import models, schemas, crud
from database import get_db
from utils.main_utils import get_current_user, require_role, _enqueue_broadcast

router = APIRouter(prefix="/fieldtech-companies", tags=["fieldtech-companies"])


@router.get("/states")
def list_us_states():
    from region_utils import get_us_states_for_dropdown
    return get_us_states_for_dropdown()


@router.get("/regions")
def list_regions():
    from region_utils import _STATE_TO_REGION
    return sorted(set(_STATE_TO_REGION.values()))


@router.get("/zip/{zip_code}")
def lookup_zip_code(zip_code: str):
    from zip_lookup import lookup_zip
    result = lookup_zip(zip_code)
    if result is None:
        return {"city": None, "state": None, "lat": None, "lng": None}
    return result


@router.post("/", response_model=schemas.FieldTechCompanyOut)
def create_company(
    data: schemas.FieldTechCompanyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
):
    result = crud.create_field_tech_company(db=db, company=data)
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"field_tech_company","action":"create"}')
    return result


@router.get("/", response_model=List[schemas.FieldTechCompanyOut])
def list_companies(
    skip: int = 0,
    limit: int = 500,
    region: Optional[str] = None,
    state: Optional[str] = None,
    city: Optional[str] = None,
    include_techs: bool = False,
    for_map: bool = False,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    from zip_lookup import lookup_zip
    companies = crud.get_field_tech_companies(db, skip=skip, limit=limit, region=region, state=state, city=city, include_techs=include_techs)
    if not include_techs and not for_map:
        return companies
    out = []
    for c in companies:
        obj = schemas.FieldTechCompanyOut.model_validate(c)
        d = obj.model_dump()
        if for_map and c.zip:
            z = lookup_zip(c.zip)
            if z:
                d["lat"] = z.get("lat")
                d["lng"] = z.get("lng")
        if include_techs and hasattr(c, "techs"):
            techs = getattr(c, "techs", None) or []
            d["techs"] = [schemas.FieldTechOutNested.model_validate(t) for t in techs]
        out.append(schemas.FieldTechCompanyOut(**d))
    return out


@router.get("/{company_id}", response_model=schemas.FieldTechCompanyOut)
def get_company(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    company = crud.get_field_tech_company(db, company_id=company_id)
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.put("/{company_id}", response_model=schemas.FieldTechCompanyOut)
def update_company(
    company_id: str,
    data: schemas.FieldTechCompanyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    background_tasks: BackgroundTasks = None,
):
    result = crud.update_field_tech_company(db, company_id=company_id, company=data)
    if not result:
        raise HTTPException(status_code=404, detail="Company not found")
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"field_tech_company","action":"update"}')
    return result


@router.delete("/{company_id}")
def delete_company(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_role([models.UserRole.admin.value, models.UserRole.dispatcher.value])),
    background_tasks: BackgroundTasks = None,
):
    try:
        crud.delete_field_tech_company(db, company_id=company_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if background_tasks:
        _enqueue_broadcast(background_tasks, '{"type":"field_tech_company","action":"delete"}')
    return {"success": True, "message": "Company deleted"}


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    v = str(value).strip()
    return v if v else None


def _join_address(parts: list[str | None]) -> str | None:
    cleaned = [p for p in (_clean(p) for p in parts) if p]
    if not cleaned:
        return None
    return ", ".join(cleaned)


@router.post("/import")
def import_companies_from_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a .csv file")

    content = file.file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    created_companies = 0
    updated_companies = 0
    created_techs = 0
    skipped_rows = 0

    for row in reader:
        company_name = _clean(row.get("Company"))
        first_name = _clean(row.get("First Name"))
        last_name = _clean(row.get("Last Name"))
        email = _clean(row.get("E-mail Address"))

        if not company_name and not (first_name or last_name):
            skipped_rows += 1
            continue

        address = _join_address([
            row.get("Business Street"),
            row.get("Business Street 2"),
            row.get("Business Street 3"),
        ])
        city = _clean(row.get("Business City"))
        state = _clean(row.get("Business State"))
        zip_code = _clean(row.get("Business Postal Code"))
        notes = _clean(row.get("Notes"))

        business_phone = _clean(row.get("Business Phone")) or _clean(row.get("Company Main Phone"))

        other_phone_fields = [
            ("Business Phone 2", row.get("Business Phone 2")),
            ("Company Main Phone", row.get("Company Main Phone")),
            ("Mobile Phone", row.get("Mobile Phone")),
            ("Home Phone", row.get("Home Phone")),
            ("Home Phone 2", row.get("Home Phone 2")),
            ("Other Phone", row.get("Other Phone")),
            ("Business Fax", row.get("Business Fax")),
            ("Home Fax", row.get("Home Fax")),
            ("Other Fax", row.get("Other Fax")),
            ("Assistant's Phone", row.get("Assistant's Phone")),
            ("Primary Phone", row.get("Primary Phone")),
            ("Pager", row.get("Pager")),
            ("Callback", row.get("Callback")),
            ("Car Phone", row.get("Car Phone")),
            ("Radio Phone", row.get("Radio Phone")),
            ("TTY/TDD Phone", row.get("TTY/TDD Phone")),
            ("Telex", row.get("Telex")),
            ("ISDN", row.get("ISDN")),
        ]
        other_numbers = []
        for label, value in other_phone_fields:
            v = _clean(value)
            if not v:
                continue
            if business_phone and v == business_phone:
                continue
            other_numbers.append(f"{label}: {v}")
        other_phones = "\n".join(other_numbers) if other_numbers else None

        existing_company = None
        if company_name:
            existing_company = db.query(models.FieldTechCompany).filter(
                func.lower(func.coalesce(models.FieldTechCompany.company_name, "")) == company_name.lower(),
                func.lower(func.coalesce(models.FieldTechCompany.address, "")) == (address or "").lower(),
                func.lower(func.coalesce(models.FieldTechCompany.city, "")) == (city or "").lower(),
                func.lower(func.coalesce(models.FieldTechCompany.state, "")) == (state or "").lower(),
                func.lower(func.coalesce(models.FieldTechCompany.zip, "")) == (zip_code or "").lower(),
            ).first()

        if existing_company:
            updated = False
            for field, value in {
                "business_phone": business_phone,
                "other_phones": other_phones,
                "address": address,
                "city": city,
                "state": state,
                "zip": zip_code,
                "notes": notes,
            }.items():
                if value and not getattr(existing_company, field):
                    setattr(existing_company, field, value)
                    updated = True
                elif value and field == "other_phones" and getattr(existing_company, field):
                    existing_text = getattr(existing_company, field) or ""
                    for line in value.split("\n"):
                        if line not in existing_text:
                            existing_text = f"{existing_text}\n{line}".strip()
                            updated = True
                    setattr(existing_company, field, existing_text)
            if updated:
                updated_companies += 1
        else:
            if not company_name:
                skipped_rows += 1
                continue
            company_payload = schemas.FieldTechCompanyCreate(
                company_name=company_name,
                company_number=None,
                business_phone=business_phone,
                other_phones=other_phones,
                address=address,
                city=city,
                state=state,
                zip=zip_code,
                notes=notes,
            )
            existing_company = crud.create_field_tech_company(db, company_payload)
            created_companies += 1

        tech_name = " ".join([p for p in [first_name, last_name] if p]).strip()
        if tech_name and existing_company:
            existing_tech = db.query(models.FieldTech).filter(
                models.FieldTech.company_id == existing_company.company_id,
                func.lower(models.FieldTech.name) == tech_name.lower()
            ).first()
            if not existing_tech:
                tech_payload = schemas.FieldTechCreate(
                    company_id=existing_company.company_id,
                    name=tech_name,
                    phone=None,
                    email=email,
                    city=city,
                    state=state,
                    zip=zip_code,
                )
                crud.create_field_tech(db, tech_payload)
                created_techs += 1

    db.commit()
    return {
        "created_companies": created_companies,
        "updated_companies": updated_companies,
        "created_techs": created_techs,
        "skipped_rows": skipped_rows,
    }
