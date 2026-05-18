from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import Base, engine, get_db
import models

Base.metadata.create_all(bind=engine)

app = FastAPI(title="WorkHub API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ROOT = Path(__file__).parent


# ─── Schemas ───

class StudentIn(BaseModel):
    name: str
    roll: str = ""
    cls: str = ""
    section: str = ""
    contact: str = ""


class TaskIn(BaseModel):
    text: str
    type: str = "Personal"
    priority: str = "Medium"
    due: str = ""
    time: str = ""
    done: bool = False
    created: str = ""


class NoteIn(BaseModel):
    title: str = "Untitled"
    body: str = ""
    category: str = "Personal"
    created: str = ""
    updated: str = ""


class ExamIn(BaseModel):
    name: str
    subject: str = ""
    date: str = ""
    max: float = 100


class LessonIn(BaseModel):
    day: str = "Monday"
    time: str = ""
    subject: str
    cls: str = ""
    topic: str = ""
    status: str = "Pending"


class EventIn(BaseModel):
    name: str
    date: str = ""
    time: str = ""
    venue: str = ""
    status: str = "Planning"
    notes: str = ""


class AttendanceIn(BaseModel):
    date: str
    student_id: int
    status: str


class MarksSaveIn(BaseModel):
    exam_id: int
    marks: dict[str, str]


class ChecklistItemIn(BaseModel):
    text: str
    done: bool = False


class QuickNoteIn(BaseModel):
    value: str


# ─── Helpers ───

def student_out(s: models.Student) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "roll": s.roll or "",
        "cls": s.cls or "",
        "section": s.section or "",
        "contact": s.contact or "",
    }


def build_attendance_map(db: Session) -> dict:
    result: dict = {}
    for row in db.query(models.Attendance).all():
        result.setdefault(row.date, {})[str(row.student_id)] = row.status
    return result


def build_marks_map(db: Session) -> dict:
    result: dict = {}
    for row in db.query(models.Mark).all():
        result.setdefault(str(row.exam_id), {})[str(row.student_id)] = row.score
    return result


def build_checklists_map(db: Session) -> dict:
    result: dict = {}
    items = (
        db.query(models.ChecklistItem)
        .order_by(models.ChecklistItem.event_id, models.ChecklistItem.sort_order)
        .all()
    )
    for item in items:
        result.setdefault(str(item.event_id), []).append(
            {"id": item.id, "text": item.text, "done": item.done}
        )
    return result


# ─── Static ───

@app.get("/")
def index():
    return FileResponse(ROOT / "planner.html")


@app.get("/app.js")
def app_js():
    return FileResponse(ROOT / "app.js", media_type="application/javascript")


# ─── Bootstrap ───

@app.get("/api/bootstrap")
def bootstrap(db: Session = Depends(get_db)):
    setting = db.query(models.Setting).filter(models.Setting.key == "quicknote").first()
    return {
        "tasks": [
            {
                "id": t.id,
                "text": t.text,
                "type": t.type,
                "priority": t.priority,
                "due": t.due or "",
                "time": t.time or "",
                "done": t.done,
                "created": t.created or "",
            }
            for t in db.query(models.Task).all()
        ],
        "students": [student_out(s) for s in db.query(models.Student).order_by(models.Student.id).all()],
        "attendance": build_attendance_map(db),
        "marks": build_marks_map(db),
        "exams": [
            {
                "id": e.id,
                "name": e.name,
                "subject": e.subject or "",
                "date": e.date or "",
                "max": e.max,
            }
            for e in db.query(models.Exam).all()
        ],
        "lessons": [
            {
                "id": l.id,
                "day": l.day,
                "time": l.time or "",
                "subject": l.subject,
                "cls": l.cls or "",
                "topic": l.topic or "",
                "status": l.status,
            }
            for l in db.query(models.Lesson).all()
        ],
        "events": [
            {
                "id": e.id,
                "name": e.name,
                "date": e.date or "",
                "time": e.time or "",
                "venue": e.venue or "",
                "status": e.status,
                "notes": e.notes or "",
            }
            for e in db.query(models.Event).all()
        ],
        "checklists": build_checklists_map(db),
        "notes": [
            {
                "id": n.id,
                "title": n.title,
                "body": n.body or "",
                "category": n.category or "Personal",
                "created": n.created or "",
                "updated": n.updated or "",
            }
            for n in db.query(models.Note).all()
        ],
        "quicknote": setting.value if setting else "",
    }


# ─── Students ───

@app.get("/api/students")
def list_students(q: str = "", db: Session = Depends(get_db)):
    query = db.query(models.Student)
    if q:
        query = query.filter(models.Student.name.ilike(f"%{q}%"))
    return [student_out(s) for s in query.order_by(models.Student.id).all()]


@app.post("/api/students", status_code=201)
def create_student(data: StudentIn, db: Session = Depends(get_db)):
    if not data.name.strip():
        raise HTTPException(400, "Name is required")
    s = models.Student(
        name=data.name.strip(),
        roll=data.roll,
        cls=data.cls,
        section=data.section,
        contact=data.contact,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return student_out(s)


@app.put("/api/students/{student_id}")
def update_student(student_id: int, data: StudentIn, db: Session = Depends(get_db)):
    s = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")
    s.name = data.name.strip()
    s.roll = data.roll
    s.cls = data.cls
    s.section = data.section
    s.contact = data.contact
    db.commit()
    db.refresh(s)
    return student_out(s)


@app.delete("/api/students/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    s = db.query(models.Student).filter(models.Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


# ─── Tasks ───

@app.post("/api/tasks", status_code=201)
def create_task(data: TaskIn, db: Session = Depends(get_db)):
    t = models.Task(**data.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"id": t.id, **data.model_dump()}


@app.patch("/api/tasks/{task_id}")
def toggle_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    t.done = not t.done
    db.commit()
    return {"id": t.id, "done": t.done}


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    t = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not t:
        raise HTTPException(404, "Task not found")
    db.delete(t)
    db.commit()
    return {"ok": True}


# ─── Notes ───

@app.post("/api/notes", status_code=201)
def create_note(data: NoteIn, db: Session = Depends(get_db)):
    n = models.Note(**data.model_dump())
    db.add(n)
    db.commit()
    db.refresh(n)
    return {"id": n.id, **data.model_dump()}


@app.put("/api/notes/{note_id}")
def update_note(note_id: int, data: NoteIn, db: Session = Depends(get_db)):
    n = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not n:
        raise HTTPException(404, "Note not found")
    for k, v in data.model_dump().items():
        setattr(n, k, v)
    db.commit()
    return {"id": n.id}


@app.delete("/api/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
    n = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not n:
        raise HTTPException(404, "Note not found")
    db.delete(n)
    db.commit()
    return {"ok": True}


# ─── Attendance ───

@app.put("/api/attendance")
def set_attendance(data: AttendanceIn, db: Session = Depends(get_db)):
    row = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.student_id == data.student_id,
            models.Attendance.date == data.date,
        )
        .first()
    )
    if row:
        row.status = data.status
    else:
        db.add(
            models.Attendance(
                student_id=data.student_id,
                date=data.date,
                status=data.status,
            )
        )
    db.commit()
    return {"ok": True}


# ─── Exams & Marks ───

@app.post("/api/exams", status_code=201)
def create_exam(data: ExamIn, db: Session = Depends(get_db)):
    e = models.Exam(**data.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"id": e.id, **data.model_dump()}


@app.put("/api/marks")
def save_marks(data: MarksSaveIn, db: Session = Depends(get_db)):
    exam = db.query(models.Exam).filter(models.Exam.id == data.exam_id).first()
    if not exam:
        raise HTTPException(404, "Exam not found")
    for sid, score in data.marks.items():
        student_id = int(sid)
        row = (
            db.query(models.Mark)
            .filter(
                models.Mark.student_id == student_id,
                models.Mark.exam_id == data.exam_id,
            )
            .first()
        )
        if row:
            row.score = str(score)
        else:
            db.add(
                models.Mark(
                    student_id=student_id,
                    exam_id=data.exam_id,
                    score=str(score),
                )
            )
    db.commit()
    return {"ok": True}


# ─── Lessons ───

@app.post("/api/lessons", status_code=201)
def create_lesson(data: LessonIn, db: Session = Depends(get_db)):
    l = models.Lesson(**data.model_dump())
    db.add(l)
    db.commit()
    db.refresh(l)
    return {"id": l.id, **data.model_dump()}


@app.patch("/api/lessons/{lesson_id}")
def toggle_lesson(lesson_id: int, db: Session = Depends(get_db)):
    l = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(404, "Lesson not found")
    statuses = ["Pending", "Completed", "Postponed"]
    idx = statuses.index(l.status) if l.status in statuses else 0
    l.status = statuses[(idx + 1) % len(statuses)]
    db.commit()
    return {"id": l.id, "status": l.status}


@app.delete("/api/lessons/{lesson_id}")
def delete_lesson(lesson_id: int, db: Session = Depends(get_db)):
    l = db.query(models.Lesson).filter(models.Lesson.id == lesson_id).first()
    if not l:
        raise HTTPException(404, "Lesson not found")
    db.delete(l)
    db.commit()
    return {"ok": True}


# ─── Events ───

@app.post("/api/events", status_code=201)
def create_event(data: EventIn, db: Session = Depends(get_db)):
    e = models.Event(**data.model_dump())
    db.add(e)
    db.commit()
    db.refresh(e)
    return {"id": e.id, **data.model_dump()}


@app.put("/api/events/{event_id}")
def update_event(event_id: int, data: EventIn, db: Session = Depends(get_db)):
    e = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not e:
        raise HTTPException(404, "Event not found")
    for k, v in data.model_dump().items():
        setattr(e, k, v)
    db.commit()
    return {"id": e.id}


@app.delete("/api/events/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    e = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not e:
        raise HTTPException(404, "Event not found")
    db.delete(e)
    db.commit()
    return {"ok": True}


# ─── Checklists ───

@app.post("/api/checklists/{event_id}/items", status_code=201)
def add_checklist_item(event_id: int, data: ChecklistItemIn, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    count = db.query(models.ChecklistItem).filter(models.ChecklistItem.event_id == event_id).count()
    item = models.ChecklistItem(
        event_id=event_id,
        text=data.text,
        done=data.done,
        sort_order=count,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "text": item.text, "done": item.done}


@app.patch("/api/checklists/{event_id}/items/{item_id}")
def toggle_checklist_item(event_id: int, item_id: int, db: Session = Depends(get_db)):
    item = (
        db.query(models.ChecklistItem)
        .filter(
            models.ChecklistItem.id == item_id,
            models.ChecklistItem.event_id == event_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(404, "Item not found")
    item.done = not item.done
    db.commit()
    return {"id": item.id, "done": item.done}


@app.delete("/api/checklists/{event_id}/items/{item_id}")
def delete_checklist_item(event_id: int, item_id: int, db: Session = Depends(get_db)):
    item = (
        db.query(models.ChecklistItem)
        .filter(
            models.ChecklistItem.id == item_id,
            models.ChecklistItem.event_id == event_id,
        )
        .first()
    )
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item)
    db.commit()
    return {"ok": True}


# ─── Settings ───

@app.put("/api/settings/quicknote")
def save_quicknote(data: QuickNoteIn, db: Session = Depends(get_db)):
    row = db.query(models.Setting).filter(models.Setting.key == "quicknote").first()
    if row:
        row.value = data.value
    else:
        db.add(models.Setting(key="quicknote", value=data.value))
    db.commit()
    return {"ok": True}
