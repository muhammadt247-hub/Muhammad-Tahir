import os

files_to_update = [
    'app/globals.css',
    'components/generator/ControlsCard.tsx',
    'components/generator/PlatformGrid.tsx',
    'components/layout/Header.tsx',
    'components/generator/DropZone.tsx'
]

for path in files_to_update:
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        new_content = content.replace('pop-20', 'pop-10')
        new_content = new_content.replace('--pop-scale: 1.2', '--pop-scale: 1.1')
        new_content = new_content.replace('scale(1.2)', 'scale(var(--pop-scale))')
        
        if new_content != content:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated {path}")
        else:
            print(f"No changes needed in {path}")
    else:
        print(f"File not found: {path}")
