"""The one error format the API uses (section 8):

    {"error": {"code": "validation_error", "message": "...", "fields": {...}}}
"""
from flask import jsonify
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, fields: dict | None = None):
        super().__init__(message)
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields or {}


def not_found(what: str = "Resource") -> ApiError:
    return ApiError(404, "not_found", f"{what} not found")


def error_response(status: int, code: str, message: str, fields: dict | None = None):
    return jsonify({"error": {"code": code, "message": message, "fields": fields or {}}}), status


def pydantic_fields(exc: ValidationError) -> dict:
    fields = {}
    for err in exc.errors():
        key = ".".join(str(part) for part in err["loc"]) or "body"
        fields.setdefault(key, err["msg"])
    return fields


_HTTP_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    415: "unsupported_media_type",
}


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def _api_error(exc: ApiError):
        return error_response(exc.status, exc.code, exc.message, exc.fields)

    @app.errorhandler(ValidationError)
    def _validation_error(exc: ValidationError):
        return error_response(400, "validation_error", "Invalid input", pydantic_fields(exc))

    @app.errorhandler(HTTPException)
    def _http_error(exc: HTTPException):
        status = exc.code or 500
        return error_response(status, _HTTP_CODES.get(status, "http_error"), exc.description or exc.name)

    @app.errorhandler(Exception)
    def _unhandled(exc: Exception):
        app.logger.exception("Unhandled error")
        return error_response(500, "server_error", "Something went wrong on the server")
