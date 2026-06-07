with open('src/components/PizzaCanvas.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find updateLoop definition
update_loop_start = None
for i, line in enumerate(lines, 1):
    if 'const updateLoop = () =>' in line:
        update_loop_start = i
        break

print(f'updateLoop starts at line {update_loop_start}')

# Count braces from updateLoop start to find its end
depth = 0
found_open = False
for i, line in enumerate(lines[update_loop_start-1:], update_loop_start):
    for ch in line:
        if ch == '{':
            depth += 1
            found_open = True
        elif ch == '}':
            depth -= 1
    if found_open and depth == 0:
        next_line = lines[i].strip()[:80] if i < len(lines) else 'EOF'
        print(f'updateLoop ends at line {i}: {line.strip()[:80]}')
        print(f'Next line {i+1}: {next_line}')
        print(f'Line {i+2}: {lines[i+1].strip()[:80] if i+1 < len(lines) else "EOF"}')
        break

# Also find the useEffect containing updateLoop
# Find the useEffect that starts before updateLoop
for i in range(update_loop_start - 2, max(0, update_loop_start - 60), -1):
    if 'useEffect(' in lines[i]:
        print(f'Containing useEffect starts at line {i+1}: {lines[i].strip()[:80]}')
        break
