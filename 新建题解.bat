@echo off
setlocal
cd /d "%~dp0"
title New Post Template
echo.
set /p POST_TITLE=Title:
if "%POST_TITLE%"=="" (
  echo Title is required.
  echo.
  pause
  exit /b 1
)
echo.
set /p POST_SLUG=Slug (optional):
echo.
if "%POST_SLUG%"=="" (
  npm run new:post -- "%POST_TITLE%"
) else (
  npm run new:post -- "%POST_TITLE%" "%POST_SLUG%"
)
echo.
pause
