from ..extensions import db
from ..utils.dates import iso_datetime, utcnow


class Subject(db.Model):
    __tablename__ = "subjects"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    colour = db.Column(db.String(7), nullable=False, default="#6366F1")
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    # Deleting a subject sets subject_id to null on its tasks (section 7).
    tasks = db.relationship("Task", backref="subject", passive_deletes=True, lazy="dynamic")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "colour": self.colour,
            "created_at": iso_datetime(self.created_at),
        }
