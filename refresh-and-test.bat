@echo off
echo Refreshing environment variables...

:: Refresh PATH from registry
for /f "tokens=2*" %%a in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%b"
for /f "tokens=2*" %%a in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "PATH=%PATH%;%%b"

:: Add common winget paths just in case
set "PATH=%PATH%;%LOCALAPPDATA%\Microsoft\WinGet\Links;%LOCALAPPDATA%\Microsoft\WinGet\Packages"

echo Testing yt-dlp...
yt-dlp --version

echo.
echo Testing XDL with YouTube...
xdl.exe https://youtube.com/watch?v=dQw4w9WgXcQ