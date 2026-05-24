@echo off
setlocal
cd /d "%~dp0"
title Import Markdown to Posts
echo.
echo Enter a markdown file path or a folder path.
echo Leave blank to use the interactive prompts.
set /p SOURCE_PATH=Path:
echo.
if "%SOURCE_PATH%"=="" (
  npm run import:posts
) else (
  npm run import:posts -- "%SOURCE_PATH%"
)
echo.
pause
