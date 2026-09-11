import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present
env_path = Path(__file__).resolve().parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from database.db import init_db
from routes.auth import router as auth_router
from routes.dogs import router as dogs_router
from routes.predictions import router as predictions_router
from routes.potty import router as potty_router
from routes.scanner import router as scanner_router

app = FastAPI(
    title="PawPotty API",
    description="Know Before They Go. An experimental AI potty radar combining routine, potty history, and real-time behavior.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
init_db()

# Mount API Routers
app.include_router(auth_router)
app.include_router(dogs_router)
app.include_router(predictions_router)
app.include_router(potty_router)
app.include_router(scanner_router)


@app.get("/api/health")
def health_check():
    """PawPotty health & capability check."""
    from services.yolo_service import get_yolo_capabilities
    caps = get_yolo_capabilities()
    return {
        "status": "ok",
        "app": "PawPotty",
        "tagline": "Know Before They Go. 🐾",
        "personality": "Friendly dog detective 🐶",
        "capabilities": caps
    }


# Static Frontend Files Serving
frontend_dir = Path(__file__).resolve().parent.parent / "frontend"
if frontend_dir.exists():
    # Mount css and js
    css_dir = frontend_dir / "css"
    js_dir = frontend_dir / "js"
    if css_dir.exists():
        app.mount("/css", StaticFiles(directory=str(css_dir)), name="css")
    if js_dir.exists():
        app.mount("/js", StaticFiles(directory=str(js_dir)), name="js")

    # Serve HTML pages directly
    @app.get("/")
    def serve_index():
        index_file = frontend_dir / "index.html"
        if index_file.exists():
            return FileResponse(str(index_file))
        return {"message": "PawPotty API is running. Frontend index.html not found."}

    @app.get("/{page}.html")
    def serve_html_page(page: str):
        page_file = frontend_dir / f"{page}.html"
        if page_file.exists():
            return FileResponse(str(page_file))
        return JSONResponse(status_code=404, content={"message": f"Page {page}.html not found."})


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Our poop detective got distracted. Try again.",
            "error_message": str(exc)
        }
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
