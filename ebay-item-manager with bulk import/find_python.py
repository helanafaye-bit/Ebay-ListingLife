#!/usr/bin/env python3
"""
Cross-platform Python finder and launcher
This script finds any available Python 3.x installation and runs the storage server
Works on Windows, Mac, and Linux
"""
import sys
import subprocess
import os
import platform

def find_python_command():
    """Find any available Python 3.x command"""
    # List of possible Python commands to try
    python_commands = [
        'python3',
        'python',
        'py',  # Windows Python launcher
    ]
    
    # On Windows, also try versioned commands
    if platform.system() == 'Windows':
        # Try python3.14, python3.13, etc. down to python3.7
        for version in range(14, 6, -1):  # 14 down to 7
            python_commands.append(f'python3.{version}')
            python_commands.append(f'python{version}')
    
    # Try each command
    for cmd in python_commands:
        try:
            # Check if command exists and is Python 3.x
            result = subprocess.run(
                [cmd, '--version'],
                capture_output=True,
                text=True,
                timeout=2
            )
            if result.returncode == 0:
                version_output = result.stdout.strip() or result.stderr.strip()
                # Check if it's Python 3.x
                if 'Python 3.' in version_output:
                    # Verify it can import required modules
                    try:
                        check_result = subprocess.run(
                            [cmd, '-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)'],
                            capture_output=True,
                            timeout=2
                        )
                        if check_result.returncode == 0:
                            return cmd, version_output
                    except:
                        continue
        except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
            continue
    
    return None, None

def main():
    """Main entry point"""
    python_cmd, version = find_python_command()
    
    if not python_cmd:
        print("=" * 60)
        print("ERROR: Python 3.x not found")
        print("=" * 60)
        print()
        print("Please install Python 3.7 or higher from:")
        print("https://www.python.org/downloads/")
        print()
        if platform.system() == 'Windows':
            print("On Windows, make sure to check 'Add Python to PATH' during installation")
            print("Or use the Python Launcher: py -3")
        else:
            print("On Mac/Linux, Python 3 is usually pre-installed.")
            print("If not, install via: brew install python3 (Mac) or apt-get install python3 (Linux)")
        print()
        input("Press Enter to exit...")
        sys.exit(1)
    
    print("=" * 60)
    print("ListingLife Storage Server")
    print("=" * 60)
    print()
    print(f"Python found: {python_cmd}")
    print(f"Version: {version}")
    print()
    
    # Check if requirements are installed
    print("Checking dependencies...")
    try:
        result = subprocess.run(
            [python_cmd, '-m', 'pip', 'show', 'flask'],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode != 0:
            print("Installing dependencies...")
            subprocess.run(
                [python_cmd, '-m', 'pip', 'install', '--upgrade', 'pip'],
                check=False
            )
            subprocess.run(
                [python_cmd, '-m', 'pip', 'install', '-r', 'requirements.txt'],
                check=True
            )
    except subprocess.TimeoutExpired:
        print("WARNING: Dependency check timed out, continuing anyway...")
    except subprocess.CalledProcessError as e:
        print(f"ERROR: Failed to install dependencies: {e}")
        print()
        print("Try running install_requirements.bat (Windows) or install_requirements.sh (Mac/Linux) first")
        input("Press Enter to exit...")
        sys.exit(1)
    except FileNotFoundError:
        print("WARNING: pip not found, trying to continue anyway...")
    
    print()
    print("Starting storage server...")
    print("Press Ctrl+C to stop the server")
    print()
    
    # Run the storage server
    try:
        subprocess.run([python_cmd, 'storage_server.py'], check=True)
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"\nERROR: Server exited with error: {e}")
        input("Press Enter to exit...")
        sys.exit(1)

if __name__ == '__main__':
    main()

