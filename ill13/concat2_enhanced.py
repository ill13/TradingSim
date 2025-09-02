import os
import json
from pathlib import Path
from datetime import datetime, timedelta
import re
import time

# Try to import tiktoken, fall back to estimation if not available
try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False

# Default configuration - will be written to concat_config.json if it doesn't exist
DEFAULT_CONFIG = {
    "ignored_files": [
        "config.php", "local-config.php", "debug.php", "blog.db", "Parsedown.php",
        "claude_concat.py", "sql_app.db", "simplemd.db", "README.md", "notes.txt",
        "pt10.py", ".gitignore", "concat.py", "__init__.gd", "mvp.css",
        "simple.min.css", "ill13_coding.md", "classless-tiny.css", "classless.css",
        "complaints.txt", "profile_samples.txt", "__init__.py", "MTS_combined_files.txt",
        "MTS_file_tree.txt", "create_folders_script.py", "frontend_reference_template.md",
        "concat2.py", "concat_config.json","styles.css"
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
    ],
    # Token counting configuration
    "token_config": {
        "encoding": "cl100k_base",
        "red_threshold": 180000,    # Danger zone
        "yellow_threshold": 120000, # Caution zone
        "file_warning_threshold": 5000,  # 🔥 for files >5K tokens
        "file_caution_threshold": 2000   # ⚠️ for files >2K tokens
    }
}

def load_config():
    """Load configuration from concat_config.json in script directory, create if doesn't exist"""
    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    config_file = script_dir / "concat_config.json"
    
    if not config_file.exists():
        print(f"Creating {config_file} with default settings...")
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(DEFAULT_CONFIG, f, indent=2)
        print(f"Config file created! You can edit {config_file} to customize ignored files and directories.")
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
        print(f"Error loading {config_file}: {e}")
        print("Using default configuration...")
        return DEFAULT_CONFIG

def estimate_tokens(text, encoding_name="cl100k_base"):
    """Estimate token count using tiktoken or fallback to character/4 estimation"""
    if not text:
        return 0
    
    if TIKTOKEN_AVAILABLE:
        try:
            encoding = tiktoken.get_encoding(encoding_name)
            return len(encoding.encode(text))
        except Exception as e:
            print(f"Warning: tiktoken error ({e}), falling back to estimation")
    
    # Fallback: rough estimation (characters ÷ 4)
    return len(text) // 4

def format_token_count(tokens, config):
    """Format token count with color coding based on thresholds"""
    red_threshold = config["token_config"]["red_threshold"]
    yellow_threshold = config["token_config"]["yellow_threshold"]
    
    if tokens >= red_threshold:
        return f"\033[91m{tokens:,}\033[0m"  # Red
    elif tokens >= yellow_threshold:
        return f"\033[93m{tokens:,}\033[0m"  # Yellow
    else:
        return f"\033[92m{tokens:,}\033[0m"  # Green

def get_threshold_status(tokens, config):
    """Get threshold status: 'red', 'yellow', or 'green'"""
    red_threshold = config["token_config"]["red_threshold"]
    yellow_threshold = config["token_config"]["yellow_threshold"]
    
    if tokens >= red_threshold:
        return "red"
    elif tokens >= yellow_threshold:
        return "yellow"
    else:
        return "green"

def get_file_warning_icon(tokens, config):
    """Get warning icon for files based on token count"""
    warning_threshold = config["token_config"]["file_warning_threshold"]
    caution_threshold = config["token_config"]["file_caution_threshold"]
    
    if tokens >= warning_threshold:
        return "🔥"
    elif tokens >= caution_threshold:
        return "⚠️ "
    else:
        return ""

def prompt_user_continue(tokens, config, context=""):
    """Prompt user whether to continue based on token threshold"""
    status = get_threshold_status(tokens, config)
    
    if status == "green":
        return True  # Auto-continue for green
    
    formatted_tokens = format_token_count(tokens, config)
    print(f"\n{'='*50}")
    print(f"Token count: {formatted_tokens}")
    if context:
        print(f"Context: {context}")
    
    if status == "red":
        print("🚨 RED THRESHOLD EXCEEDED - High token usage!")
        choices = "Continue? [y/n/s/q] (yes/no/skip/quit): "
        valid_choices = ['y', 'n', 's', 'q']
    else:  # yellow
        print("⚠️  YELLOW THRESHOLD - Approaching limit")
        choices = "Continue? [y/n/s] (yes/no/skip): "
        valid_choices = ['y', 'n', 's']
    
    while True:
        choice = input(choices).lower().strip()
        if choice in valid_choices:
            if choice == 'q':
                print("Quitting...")
                exit(0)
            elif choice == 'n':
                return False
            elif choice == 's':
                return 'skip'
            else:  # 'y'
                return True
        else:
            print(f"Please enter one of: {'/'.join(valid_choices)}")

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

def calculate_directory_tokens(dir_path, current_dir, mode, config, minutes_ago=None):
    """Calculate total tokens for all files in a directory"""
    total_tokens = 0
    file_count = 0
    
    try:
        for item in dir_path.iterdir():
            if item.is_file():
                if (should_include_file(item, current_dir, mode, config) and
                    not should_ignore_file(item.name, current_dir.name, config) and
                    not is_minified(item) and
                    is_recently_modified(item, minutes_ago)):
                    
                    try:
                        with open(item, 'r', encoding='utf-8') as f:
                            content = f.read()
                            tokens = estimate_tokens(content, config["token_config"]["encoding"])
                            total_tokens += tokens
                            file_count += 1
                    except Exception:
                        continue
    except Exception:
        pass
    
    return total_tokens, file_count

def generate_file_tree(output_file, mode, config, minutes_ago=None):
    """Generate a tree structure of included files with token counts"""
    current_dir = Path.cwd()
    root_name = current_dir.name
    total_tokens = 0
    total_files = 0
    
    print(f"\nGenerating {mode} file tree with token analysis...")
    
    with open(output_file, 'w', encoding='utf-8') as treefile:
        treefile.write(f"{mode.title()} File Tree for '{current_dir.name}' - Generated {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        treefile.write(f"Mode: {mode}\n")
        if minutes_ago:
            treefile.write(f"Time filter: Files modified in last {minutes_ago} minutes\n")
        treefile.write(f"Tiktoken available: {TIKTOKEN_AVAILABLE}\n")
        treefile.write(f"Encoding: {config['token_config']['encoding']}\n")
        treefile.write("=" * 50 + "\n\n")
        
        for root, dirs, files in os.walk(current_dir):
            dirs[:] = [d for d in dirs if not should_ignore_dir(d, config)]
            
            relative_root = Path(root).relative_to(current_dir)
            depth = len(relative_root.parts)
            
            # Calculate directory token total
            dir_tokens, dir_file_count = calculate_directory_tokens(Path(root), current_dir, mode, config, minutes_ago)
            
            if depth > 0 and (dir_tokens > 0 or any(f for f in files if should_include_file(Path(root) / f, current_dir, mode, config))):
                status_icon = "🔥" if dir_tokens >= config["token_config"]["file_warning_threshold"] else ("⚠️" if dir_tokens >= config["token_config"]["file_caution_threshold"] else "✅")
                formatted_tokens = format_token_count(dir_tokens, config)
                treefile.write("│   " * (depth-1) + f"├── {relative_root.parts[-1]}/ {status_icon} [{formatted_tokens} tokens, {dir_file_count} files]\n")
            
            # Filter for included files based on mode
            included_files = []
            for f in files:
                filepath = Path(root) / f
                if (should_include_file(filepath, current_dir, mode, config) and 
                    not should_ignore_file(f, root_name, config) and 
                    not is_minified(filepath) and
                    is_recently_modified(filepath, minutes_ago)):
                    
                    try:
                        with open(filepath, 'r', encoding='utf-8') as file_handle:
                            content = file_handle.read()
                            tokens = estimate_tokens(content, config["token_config"]["encoding"])
                            included_files.append((f, tokens))
                            total_tokens += tokens
                            total_files += 1
                    except Exception:
                        included_files.append((f, 0))
            
            included_files.sort()
            
            for filename, tokens in included_files:
                warning_icon = get_file_warning_icon(tokens, config)
                formatted_tokens = format_token_count(tokens, config)
                treefile.write("│   " * depth + f"├── {filename} {warning_icon}[{formatted_tokens} tokens]\n")
        
        # Summary
        treefile.write(f"\n{'='*50}\n")
        treefile.write(f"SUMMARY\n")
        treefile.write(f"{'='*50}\n")
        treefile.write(f"Total files: {total_files}\n")
        total_formatted = format_token_count(total_tokens, config)
        treefile.write(f"Total tokens: {total_formatted}\n")
        status = get_threshold_status(total_tokens, config)
        treefile.write(f"Status: {status.upper()}\n")
        treefile.write(f"Red threshold: {config['token_config']['red_threshold']:,}\n")
        treefile.write(f"Yellow threshold: {config['token_config']['yellow_threshold']:,}\n")
    
    print(f"File tree complete! Total: {format_token_count(total_tokens, config)} tokens across {total_files} files")
    return total_tokens, total_files

def concatenate_files(output_file, mode, config, minutes_ago=None):
    """Concatenate all included files into a single file with token management"""
    current_dir = Path.cwd()
    root_name = current_dir.name
    files_processed = 0
    files_skipped = 0
    minified_skipped = 0
    time_filtered = 0
    user_skipped = 0
    running_tokens = 0
    
    if mode == 'all':
        extensions = list(set(config['backend_extensions'] + config['frontend_extensions']))
    else:
        extensions = config['backend_extensions'] if mode == 'backend' else config['frontend_extensions']
    
    print(f"Starting {mode} concatenation with real-time token counting...")
    print(f"Processing extensions: {', '.join(extensions)}")
    if minutes_ago:
        print(f"Time filter: Only files modified in last {minutes_ago} minutes")
    print(f"Tiktoken available: {TIKTOKEN_AVAILABLE}")
    print(f"Token thresholds - Yellow: {config['token_config']['yellow_threshold']:,}, Red: {config['token_config']['red_threshold']:,}")
    
    with open(output_file, 'w', encoding='utf-8') as outfile:
        header = f"{mode.title()} files from '{current_dir.name}'\n"
        header += f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
        header += f"Mode: {mode}\n"
        if minutes_ago:
            header += f"Time filter: Files modified in last {minutes_ago} minutes\n"
        header += f"Included extensions: {', '.join(extensions)}\n"
        header += f"Tiktoken available: {TIKTOKEN_AVAILABLE}\n"
        header += f"Encoding: {config['token_config']['encoding']}\n"
        header += "=" * 50 + "\n\n"
        
        outfile.write(header)
        running_tokens += estimate_tokens(header, config["token_config"]["encoding"])
        
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
                        content = infile.read()
                        file_tokens = estimate_tokens(content, config["token_config"]["encoding"])
                        
                        # Calculate total tokens if this file were added
                        file_header = f"{'=' * 50}\n"
                        file_header += f"FILE: {relative_path}\n"
                        file_mtime = filepath.stat().st_mtime
                        file_datetime = datetime.fromtimestamp(file_mtime)
                        file_header += f"MODIFIED: {file_datetime.strftime('%Y-%m-%d %H:%M:%S')}\n"
                        file_header += f"TOKENS: {format_token_count(file_tokens, config)}\n"
                        file_header += f"{'=' * 50}\n\n"
                        
                        header_tokens = estimate_tokens(file_header, config["token_config"]["encoding"])
                        projected_total = running_tokens + header_tokens + file_tokens + 2  # +2 for newlines
                        
                        # Check if we should prompt user
                        warning_icon = get_file_warning_icon(file_tokens, config)
                        print(f"\nNext file: {relative_path} {warning_icon}({format_token_count(file_tokens, config)} tokens)")
                        print(f"Running total would be: {format_token_count(projected_total, config)}")
                        
                        user_choice = prompt_user_continue(
                            projected_total, 
                            config, 
                            f"Adding file: {relative_path}"
                        )
                        
                        if user_choice is False:
                            print("Stopping concatenation.")
                            break
                        elif user_choice == 'skip':
                            print(f"Skipping: {relative_path}")
                            user_skipped += 1
                            continue
                        
                        # Add the file
                        outfile.write(file_header)
                        outfile.write(content)
                        outfile.write("\n\n")
                        
                        running_tokens = projected_total
                        files_processed += 1
                        print(f"✅ Added: {relative_path}")
                
                except Exception as e:
                    print(f"Error processing {filepath}: {str(e)}")
            else:
                continue  # Continue to next directory
            break  # Break from outer loop if inner loop was broken

    # Final summary
    print(f"\n{'='*50}")
    print(f"{mode.title()} CONCATENATION COMPLETE")
    print(f"{'='*50}")
    print(f"Files processed: {files_processed}")
    print(f"Files skipped (ignored): {files_skipped}")
    print(f"Files skipped (minified): {minified_skipped}")
    print(f"Files skipped (user): {user_skipped}")
    if minutes_ago:
        print(f"Files skipped (time filter): {time_filtered}")
    print(f"Final token count: {format_token_count(running_tokens, config)}")
    print(f"Status: {get_threshold_status(running_tokens, config).upper()}")
    print(f"Output saved to: {output_file}")
    
    return running_tokens

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
        print("Enhanced File Concatenator with Token Management")
        print(f"Tiktoken available: {TIKTOKEN_AVAILABLE}")
        if not TIKTOKEN_AVAILABLE:
            print("⚠️  Install tiktoken for accurate token counting: pip install tiktoken")
            print("Using character÷4 estimation as fallback")
        print()
        
        config = load_config()
        mode = get_user_choice()
        minutes_ago = get_time_filter()
        
        concat_file, tree_file = get_output_filenames(mode, minutes_ago)
        
        # Generate tree first (for overview)
        total_tree_tokens, total_files = generate_file_tree(tree_file, mode, config, minutes_ago)
        
        # Prompt before concatenation if high token count
        print(f"\nTree analysis complete: {format_token_count(total_tree_tokens, config)} tokens across {total_files} files")
        
        if not prompt_user_continue(total_tree_tokens, config, "Starting concatenation with all files"):
            print("Concatenation cancelled.")
        else:
            final_tokens = concatenate_files(concat_file, mode, config, minutes_ago)
            
            print(f"\n🎉 All operations complete!")
            print(f"Tree file: {tree_file}")
            print(f"Concatenated file: {concat_file}")
            print(f"Final status: {get_threshold_status(final_tokens, config).upper()}")
        
    except KeyboardInterrupt:
        print("\n\nOperation cancelled by user.")
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        import traceback
        traceback.print_exc()