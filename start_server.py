#!/usr/bin/env python3
"""
AboutWater Route Optimizer - Server Startup Script
This script ensures consistent server configuration and port usage.
"""

import os
import sys
import subprocess
import time
import signal
import psutil
from pathlib import Path

# Server Configuration
DEFAULT_PORT = 8000
SERVER_NAME = "AboutWater Route Optimizer"
PYTHON_EXECUTABLE = "python"
MAIN_FILE = "main.py"

def find_process_on_port(port):
    """Find process using the specified port"""
    try:
        for proc in psutil.process_iter(['pid', 'name', 'connections']):
            try:
                connections = proc.info['connections']
                if connections:
                    for conn in connections:
                        if conn.laddr.port == port:
                            return proc.info['pid']
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                pass
    except Exception as e:
        print(f"Error finding process on port {port}: {e}")
    return None

def kill_process(pid):
    """Kill process by PID"""
    try:
        process = psutil.Process(pid)
        process.terminate()
        time.sleep(2)
        if process.is_running():
            process.kill()
        print(f"Process {pid} terminated")
        return True
    except Exception as e:
        print(f"Error killing process {pid}: {e}")
        return False

def check_dependencies():
    """Check if required dependencies are installed"""
    required_files = [MAIN_FILE, "requirements.txt"]
    missing_files = []
    
    for file in required_files:
        if not Path(file).exists():
            missing_files.append(file)
    
    if missing_files:
        print(f"ERROR - Missing required files: {', '.join(missing_files)}")
        return False
    
    print("SUCCESS - All required files found")
    return True

def start_server(port=DEFAULT_PORT):
    """Start the server on the specified port"""
    print(f"STARTING {SERVER_NAME} on port {port}")
    print("=" * 50)
    
    # Check if port is already in use
    existing_pid = find_process_on_port(port)
    if existing_pid:
        print(f"WARNING - Port {port} is already in use by process {existing_pid}")
        response = input("Do you want to terminate the existing process? (y/N): ")
        if response.lower() in ['y', 'yes']:
            if kill_process(existing_pid):
                print(f"SUCCESS - Process {existing_pid} terminated")
                time.sleep(2)
            else:
                print(f"ERROR - Failed to terminate process {existing_pid}")
                return False
        else:
            print("ERROR - Cannot start server - port is in use")
            return False
    
    # Check dependencies
    if not check_dependencies():
        return False
    
    # Set environment variables
    env = os.environ.copy()
    env['PORT'] = str(port)
    env['ENVIRONMENT'] = 'development'
    
    try:
        print(f"Working directory: {os.getcwd()}")
        print(f"Python executable: {PYTHON_EXECUTABLE}")
        print(f"Main file: {MAIN_FILE}")
        print(f"Port: {port}")
        print("=" * 50)
        
        # Start the server
        process = subprocess.Popen(
            [PYTHON_EXECUTABLE, MAIN_FILE],
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        print(f"SUCCESS - Server started with PID: {process.pid}")
        print(f"Access the application at: http://localhost:{port}")
        print("=" * 50)
        print("Press Ctrl+C to stop the server")
        print("=" * 50)
        
        # Monitor the process
        try:
            while process.poll() is None:
                output = process.stdout.readline()
                if output:
                    print(output.strip())
                time.sleep(0.1)
        except KeyboardInterrupt:
            print("\nSTOPPING server...")
            process.terminate()
            time.sleep(2)
            if process.poll() is None:
                process.kill()
            print("SUCCESS - Server stopped")
        
        return True
        
    except Exception as e:
        print(f"ERROR - Error starting server: {e}")
        return False

def main():
    """Main function"""
    print(f"{SERVER_NAME} - Server Startup Script")
    print("=" * 50)
    
    # Parse command line arguments
    port = DEFAULT_PORT
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
            if port < 1024 or port > 65535:
                print(f"ERROR - Invalid port number: {port}. Must be between 1024 and 65535")
                sys.exit(1)
        except ValueError:
            print(f"ERROR - Invalid port number: {sys.argv[1]}")
            sys.exit(1)
    
    # Start the server
    success = start_server(port)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
