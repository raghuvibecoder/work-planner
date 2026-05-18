from sqlalchemy import Boolean, Column, Date, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from database import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    roll = Column(String(50), default="")
    cls = Column("class", String(100), default="")
    section = Column(String(50), default="")
    contact = Column(String(100), default="")

    attendance_records = relationship("Attendance", back_populates="student", cascade="all, delete-orphan")
    mark_records = relationship("Mark", back_populates="student", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    text = Column(Text, nullable=False)
    type = Column(String(50), default="Personal")
    priority = Column(String(20), default="Medium")
    due = Column(String(20), default="")
    time = Column(String(20), default="")
    done = Column(Boolean, default=False)
    created = Column(String(20), default="")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(300), default="Untitled")
    body = Column(Text, default="")
    category = Column(String(50), default="Personal")
    created = Column(String(50), default="")
    updated = Column(String(50), default="")


class Exam(Base):
    __tablename__ = "exams"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    subject = Column(String(100), default="")
    date = Column(String(20), default="")
    max = Column(Float, default=100)

    marks = relationship("Mark", back_populates="exam", cascade="all, delete-orphan")


class Mark(Base):
    __tablename__ = "marks"
    __table_args__ = (UniqueConstraint("student_id", "exam_id", name="uq_student_exam"),)

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    exam_id = Column(Integer, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    score = Column(String(20), default="")

    student = relationship("Student", back_populates="mark_records")
    exam = relationship("Exam", back_populates="marks")


class Attendance(Base):
    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("student_id", "date", name="uq_student_date"),)

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    date = Column(String(20), nullable=False)
    status = Column(String(1), default="P")

    student = relationship("Student", back_populates="attendance_records")


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    day = Column(String(20), default="Monday")
    time = Column(String(50), default="")
    subject = Column(String(100), nullable=False)
    cls = Column("class", String(100), default="")
    topic = Column(String(300), default="")
    status = Column(String(20), default="Pending")


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(300), nullable=False)
    date = Column(String(20), default="")
    time = Column(String(50), default="")
    venue = Column(String(200), default="")
    status = Column(String(50), default="Planning")
    notes = Column(Text, default="")

    checklist_items = relationship("ChecklistItem", back_populates="event", cascade="all, delete-orphan")


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    text = Column(Text, nullable=False)
    done = Column(Boolean, default=False)
    sort_order = Column(Integer, default=0)

    event = relationship("Event", back_populates="checklist_items")


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(50), primary_key=True)
    value = Column(Text, default="")
