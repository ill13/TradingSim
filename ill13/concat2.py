import os
import json
from pathlib import Path
from datetime import datetime, timedelta
import re
import time

# Default configuration - will be written to config.json if it doesn't exist
DEFAULT_CONFIG = {
    "ignored_files": [
        "config.php", "local-config.php", "debug.php", "blog.db", "Parsedown.php",
        "claude_concat.py", "sql_app.db", "simplemd.db", "README.md", "notes.txt",
        "pt10.py", ".gitignore", "concat.py", "__init__.gd", "mvp.css",
        "simple.min.css", "ill13_coding.md", "classless-tiny.css", "classless.css",
        "complaints.txt", "profile_samples.txt", "__init__.py", "MTS_combined_files.txt",
        "MTS_file_tree.txt", "create_folders_script.py", "frontend_reference_template.md",
        "concat2.py", "config.json"
    ],
    "ignored_dirs": [
        "logs", "log", "cache", "vendor", "node_modules", ".git", "git", "venv",
        ".venv", "__pycache__", ".ignore", "temp", "__old", "_old", "old",
        "parser", "shader_cache", ".vscode", "storage", "_stuff", "stuff",
        "history", "texttones","ill13"
    ],
    "backend_extensions": ["py", "txt", "json", "yml", "yaml", "toml", "cfg", "ini"],
    "backend_dirs": [
        "api", "core", "dependencies", "middleware", "migrations", "models",
        "services", "scripts", "utils", "tests", "config", "data", "deployment",
        "docker", "monitoring", "src", "lib", "backend"
    ],
    "frontend_extensions": [
        "html", "css", "js", "json", "svg", "png", "jpg", "jpeg", "gif",
        "bmp", "webp", "tiff", "vue", "jsx", "tsx", "ts", "scss", "sass", "less"
    ],
    "frontend_dirs": [
        "static", "templates", "spa_examples", "public", "assets", "components",
        "views", "pages", "styles", "scripts", "frontend", "client", "web"
    ]
}

def load_config():
    """Load configuration from config.json, create if doesn't exist"""
    config_file = Path("config.json")
    
    if not config_file.exists():
        print("Creating config.json with default settings...")
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_CONFIG, f, indent=2)
        print("Config file created! You can edit config.json to customize ignored files and directories.")
        return DEFAULT_CONFIG
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        
        # Merge with defaults for any missing keys
        for key, value in DEFAULT_CONFIG.items():
            if key not in config:
                config[key] = value
        
        return config
    except Exception as e:
        print(f"Error loading config.json: {e}")
        print("Using default configuration...")
        return DEFAULT_CONFIG

def is_minified(filepath):
    """Check if a file appears to be minified based on common patterns"""
    filename = filepath.name.lower()
    
    # Check filename patterns for minified files
    if re.search(r'[\.-]min\.(js|css)$', filename):
        return True
    if re.search(r'[\.-]compressed\.(js|css)$', filename):
        return True
    
    # For larger files, check content
    if filepath.suffix.lower() in ['.js', '.css']:
        try:
            # Read first few lines to check for minification patterns
            with open(filepath, 'r', encoding='utf-8') as f:
                first_chunk = f.read(1024)  # Read first 1KB
                
                # Characteristics of minified files:
                if filepath.suffix.lower() == '.js':
                    if len(first_chunk.split('\n')[0]) > 500:
                        return True
                    if first_chunk.count('\n') < 3 and len(first_chunk) > 500:
                        return True
                    
                elif filepath.suffix.lower() == '.css':
                    if first_chunk.count('\n') < 3 and len(first_chunk) > 500:
                        return True
                    if re.search(r'[};][^\n\s]', first_chunk):
                        return True
                        
        except Exception:
            return False
            
    return False

def is_recently_modified(filepath, minutes_ago):
    """Check if file was modified within the last X minutes"""
    if minutes_ago is None:
        return True
    
    try:
        file_mtime = filepath.stat().st_mtime
        file_datetime = datetime.fromtimestamp(file_mtime)
        cutoff_time = datetime.now() - timedelta(minutes=minutes_ago)
        return file_datetime >= cutoff_time
    except Exception:
        return True

def get_output_filenames(mode, minutes_ago=None):
    """Generate output filenames based on the root directory name and mode"""
    current_dir = Path.cwd()
    root_name = current_dir.name
    
    timestamp_suffix = f"_last_{minutes_ago}min" if minutes_ago else ""
    
    if mode == 'frontend':
        concat_file = f"{root_name}_frontend_files{timestamp_suffix}.txt"
        tree_file = f"{root_name}_frontend_tree{timestamp_suffix}.txt"
    elif mode == 'backend':
        concat_file = f"{root_name}_backend_files{timestamp_suffix}.txt"
        tree_file = f"{root_name}_backend_tree{timestamp_suffix}.txt"
    else:  # all
        concat_file = f"{root_name}_all_files{timestamp_suffix}.txt"
        tree_file = f"{root_name}_all_tree{timestamp_suffix}.txt"
    
    return concat_file, tree_file

def should_ignore_file(filename, root_name=None, config=None):
    """Check if a file should be ignored based on configuration"""
    if config is None:
        config = DEFAULT_CONFIG
    
    # Check explicit ignore list
    if filename in config['ignored_files']:
        return True
    
    # Get current directory name if not provided
    if root_name is None:
        root_name = Path.cwd().name
    
    # Check if file matches output filename patterns
    output_patterns = [
        f"{root_name}_combined_files",
        f"{root_name}_file_tree",
        f"{root_name}_frontend_files",
        f"{root_name}_backend_files",
        f"{root_name}_frontend_tree",
        f"{root_name}_backend_tree",
        f"{root_name}_all_files",
        f"{root_name}_all_tree"
    ]
    
    for pattern in output_patterns:
        if filename.startswith(pattern):
            return True
            
    return False

def should_ignore_dir(dirname, config=None):
    """Check if a directory should be ignored"""
    if config is None:
        config = DEFAULT_CONFIG
    return dirname in config['ignored_dirs'] or dirname.lower() == 'git'

def is_backend_path(filepath, root_path, config):
    """Determine if a file path belongs to backend based on directory structure"""
    relative_path = filepath.relative_to(root_path)
    
    # Check if in root directory
    if len(relative_path.parts) == 1:
        # Root level Python files are backend
        if filepath.suffix.lstrip('.') in config['backend_extensions']:
            return True
        # Root level config files are backend
        if filepath.name in ['requirements.txt', 'dockerfile.txt', 'main.py', 'pyproject.toml']:
            return True
        return False
    
    # Check first directory in path
    first_dir = relative_path.parts[0]
    return first_dir in config['backend_dirs']

def should_include_file(filepath, root_path, mode, config):
    """Check if file should be included based on mode (frontend/backend/all)"""
    file_ext = filepath.suffix.lstrip('.')
    
    if mode == 'all':
        return file_ext in (config['backend_extensions'] + config['frontend_extensions'])
    
    is_backend = is_backend_path(filepath, root_path, config)
    
    if mode == 'backend':
        return is_backend and file_ext in config['backend_extensions']
    else:  # frontend
        return not is_backend and file_ext in config['frontend_extensions']

def generate_file_tree(output_file, mode, config, minutes_ago=None):
    """Generate a tree structure of included files"""
    current_dir = Path.cwd()
    root_name = current_dir.name
    
    with open(output_file, 'w', encoding='utf-8') as treefile:
        treefile.write(f"{mode.title()} File Tree for '{current_dir.name}' - Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        treefile.write(f"Mode: {mode}\n")
        if minutes_ago:
            treefile.write(f"Time filter: Files modified in last {minutes_ago} minutes\n")
        treefile.write("=" * 50 + "\n\n")
        
        for root, dirs, files in os.walk(current_dir):
            dirs[:] = [d for d in dirs if not should_ignore_dir(d, config)]
            
            relative_root = Path(root).relative_to(current_dir)
            depth = len(relative_root.parts)
            
            if depth > 0:
                treefile.write("│   " * (depth-1) + "├── " + relative_root.parts[-1] + "/\n")
            
            # Filter for included files based on mode
            included_files = []
            for f in files:
                filepath = Path(root) / f
                if (should_include_file(filepath, current_dir, mode, config) and 
                    not should_ignore_file(f, root_name, config) and 
                    not is_minified(filepath) and
                    is_recently_modified(filepath, minutes_ago)):
                    included_files.append(f)
            
            included_files.sort()
            
            for file in included_files:
                treefile.write("│   " * depth + "├── " + file + "\n")

def concatenate_files(output_file, mode, config, minutes_ago=None):
    """Concatenate all included files into a single file"""
    current_dir = Path.cwd()
    root_name = current_dir.name
    files_processed = 0
    files_skipped = 0
    minified_skipped = 0
    time_filtered = 0
    
    if mode == 'all':
        extensions = list(set(config['backend_extensions'] + config['frontend_extensions']))
    else:
        extensions = config['backend_extensions'] if mode == 'backend' else config['frontend_extensions']
    
    print(f"Starting {mode} concatenation process for '{current_dir.name}'...")
    print(f"Processing extensions: {', '.join(extensions)}")
    if minutes_ago:
        print(f"Time filter: Only files modified in last {minutes_ago} minutes")
    print(f"Ignoring directories: {', '.join(config['ignored_dirs'])}")
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        outfile.write(f"{mode.title()} files from '{current_dir.name}'\n")
        outfile.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        outfile.write(f"Mode: {mode}\n")
        if minutes_ago:
            outfile.write(f"Time filter: Files modified in last {minutes_ago} minutes\n")
        outfile.write(f"Included extensions: {', '.join(extensions)}\n")
        outfile.write("=" * 50 + "\n\n")
        
        for root, dirs, files in os.walk(current_dir):
            dirs[:] = [d for d in dirs if not should_ignore_dir(d, config)]
            
            for file in files:
                filepath = Path(root) / file
                
                if not should_include_file(filepath, current_dir, mode, config):
                    continue
                    
                if should_ignore_file(file, root_name, config):
                    files_skipped += 1
                    continue
                
                if is_minified(filepath):
                    minified_skipped += 1
                    continue
                
                if not is_recently_modified(filepath, minutes_ago):
                    time_filtered += 1
                    continue
                
                relative_path = filepath.relative_to(current_dir)
                
                try:
                    with open(filepath, 'r', encoding='utf-8') as infile:
                        outfile.write(f"{'=' * 50}\n")
                        outfile.write(f"FILE: {relative_path}\n")
                        
                        # Add timestamp info
                        file_mtime = filepath.stat().st_mtime
                        file_datetime = datetime.fromtimestamp(file_mtime)
                        outfile.write(f"MODIFIED: {file_datetime.strftime('%Y-%m-%d %H:%M:%S')}\n")
                        
                        outfile.write(f"{'=' * 50}\n\n")
                        
                        content = infile.read()
                        outfile.write(content)
                        outfile.write("\n\n")
                        
                        files_processed += 1
                        print(f"Processed: {relative_path}")
                
                except Exception as e:
                    print(f"Error processing {filepath}: {str(e)}")

    # Print summary
    print(f"\n{mode.title()} concatenation complete!")
    print(f"Files processed: {files_processed}")
    print(f"Files skipped (ignored): {files_skipped}")
    print(f"Files skipped (minified): {minified_skipped}")
    if minutes_ago:
        print(f"Files skipped (time filter): {time_filtered}")
    print(f"Output saved to: {output_file}")

def get_user_choice():
    """Get user choice for frontend, backend, or all"""
    while True:
        choice = input("Frontend, Backend, or All? (press f/b/a): ").lower().strip()
        if choice == 'f':
            return 'frontend'
        elif choice == 'b':
            return 'backend'
        elif choice == 'a':
            return 'all'
        else:
            print("Please press 'f' for frontend, 'b' for backend, or 'a' for all")

def get_time_filter():
    """Get time filter from user"""
    while True:
        choice = input("Filter by modification time? (enter minutes, or press Enter for all files): ").strip()
        if not choice:
            return None
        try:
            minutes = int(choice)
            if minutes > 0:
                return minutes
            else:
                print("Please enter a positive number of minutes")
        except ValueError:
            print("Please enter a valid number or press Enter for no filter")

if __name__ == "__main__":
    try:
        config = load_config()
        mode = get_user_choice()
        minutes_ago = get_time_filter()
        
        concat_file, tree_file = get_output_filenames(mode, minutes_ago)
        
        concatenate_files(concat_file, mode, config, minutes_ago)
        generate_file_tree(tree_file, mode, config, minutes_ago)
        
        print(f"\n{mode.title()} file tree generated successfully!")
        print(f"Tree file: {tree_file}")
        print(f"Concatenated file: {concat_file}")
        
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        import traceback
        traceback.print_exc()