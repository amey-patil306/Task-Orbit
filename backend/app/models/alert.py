from ..extensions import db
from ..utils.dates import iso_date, iso_datetime, utcnow

# overload/collision/deadline come from the workload engine (one per kind + date, deduplicated in
# alert_service); assignment/extension are notifications (PLAN_V2 section 4).
ENGINE_KINDS = ("overload", "collision", "deadline")
ALERT_KINDS = ENGINE_KINDS + ("assignment", "extension")
ALERT_SEVERITIES = ("info", "warning", "critical")


class Alert(db.Model):
    __tablename__ = "alerts"
    __table_args__ = (
        db.Index("ix_alerts_user_id_is_read", "user_id", "is_read"),
    )

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    kind = db.Column(db.Enum(*ALERT_KINDS, name="alert_kind", native_enum=False, create_constraint=True), nullable=False)
    severity = db.Column(
        db.Enum(*ALERT_SEVERITIES, name="alert_severity", native_enum=False, create_constraint=True),
        nullable=False,
        default="info",
    )
    message = db.Column(db.String(500), nullable=False)
    for_date = db.Column(db.Date, nullable=False)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "severity": self.severity,
            "message": self.message,
            "for_date": iso_date(self.for_date),
            "is_read": self.is_read,
            "created_at": iso_datetime(self.created_at),
        }
