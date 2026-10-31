import sys,re
for f in sys.argv[1:]:
    print("=====",f)
    inc=False
    for l in open(f,errors='replace'):
        if l.strip().startswith('```'):
            inc=not inc
            if inc: print('[code]')
            continue
        if inc or not l.strip(): continue
        print(l.rstrip()[:700])
