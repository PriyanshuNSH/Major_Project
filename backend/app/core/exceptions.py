"""
HealthSync AI — RFC 7807 Problem Details Exceptions & Centralized Handlers
"""

from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.logging import logger


class ProblemDetailException(Exception):
    """
    Standardized Application Exception conforming to RFC 7807 (Problem Details for HTTP APIs).
    """

    def __init__(
        self,
        status_code: int,
        title: str,
        detail: str,
        error_type: Optional[str] = None,
        invalid_params: Optional[List[Dict[str, Any]]] = None,
        headers: Optional[Dict[str, str]] = None,
    ):
        self.status_code = status_code
        self.title = title
        self.detail = detail
        self.error_type = error_type or f"https://api.healthsync.ai/errors/{title.lower().replace(' ', '-')}"
        self.invalid_params = invalid_params or []
        self.headers = headers or {}
        super().__init__(detail)


def create_problem_response(
    status_code: int,
    title: str,
    detail: str,
    instance: str,
    error_type: Optional[str] = None,
    invalid_params: Optional[List[Dict[str, Any]]] = None,
    headers: Optional[Dict[str, str]] = None,
) -> JSONResponse:
    content = {
        "type": error_type or f"https://api.healthsync.ai/errors/{title.lower().replace(' ', '-')}",
        "title": title,
        "status": status_code,
        "detail": detail,
        "instance": instance,
    }
    if invalid_params:
        content["invalid_params"] = invalid_params

    response_headers = {"Content-Type": "application/problem+json"}
    if headers:
        response_headers.update(headers)

    return JSONResponse(status_code=status_code, content=content, headers=response_headers)


def register_exception_handlers(app: FastAPI) -> None:
    """Registers centralized RFC 7807 exception handlers on the FastAPI application."""

    @app.exception_handler(ProblemDetailException)
    async def problem_detail_handler(request: Request, exc: ProblemDetailException) -> JSONResponse:
        logger.warning(
            f"Handled ProblemDetailException: [{exc.status_code}] {exc.title} - {exc.detail} at {request.url.path}"
        )
        return create_problem_response(
            status_code=exc.status_code,
            title=exc.title,
            detail=exc.detail,
            instance=request.url.path,
            error_type=exc.error_type,
            invalid_params=exc.invalid_params,
            headers=exc.headers,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        invalid_params = []
        for error in exc.errors():
            loc = " -> ".join(str(l) for l in error.get("loc", []) if l != "body")
            invalid_params.append(
                {
                    "name": loc or "request_body",
                    "reason": error.get("msg", "Invalid value"),
                    "type": error.get("type", "value_error"),
                }
            )

        logger.info(f"Input validation failure on {request.url.path}: {len(invalid_params)} errors")
        return create_problem_response(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            title="Biomarker Validation Error",
            detail="The submitted physiological or request parameters failed schema boundary validation.",
            instance=request.url.path,
            error_type="https://api.healthsync.ai/errors/validation-failed",
            invalid_params=invalid_params,
        )

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        title_map = {
            400: "Bad Request",
            401: "Unauthorized",
            403: "Forbidden",
            404: "Resource Not Found",
            405: "Method Not Allowed",
            429: "Rate Limit Exceeded",
        }
        title = title_map.get(exc.status_code, "HTTP Error")
        detail = str(exc.detail) if exc.detail else "An HTTP error occurred."

        return create_problem_response(
            status_code=exc.status_code,
            title=title,
            detail=detail,
            instance=request.url.path,
            headers=exc.headers,
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        # Crucial security guarantee: log full traceback internally, but NEVER expose it to client
        logger.exception(f"Unhandled Internal Server Exception on {request.url.path}: {str(exc)}")
        return create_problem_response(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            title="Internal Server Error",
            detail="An unexpected internal error occurred while processing the request. Details logged safely.",
            instance=request.url.path,
            error_type="https://api.healthsync.ai/errors/internal-server-error",
        )
