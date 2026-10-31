import json,sys
for f in sys.argv[1:]:
    nb=json.load(open(f))
    print("=====",f)
    for c in nb['cells']:
        if c['cell_type']=='markdown':
            print(''.join(c['source']))
