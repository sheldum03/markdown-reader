#!/usr/bin/env python3
"""Exercise the shipped binary as a real newline-delimited stdio MCP server."""
import hashlib, json, pathlib, subprocess, tempfile, sys
binary = str(pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'src-tauri/target/debug/md-html-reader').resolve())
with tempfile.TemporaryDirectory(prefix='reader-mcp-acceptance-') as directory:
    root = pathlib.Path(directory); workspace = root / 'workspace'; workspace.mkdir()
    (workspace / 'a.md').write_text('original'); (root / 'secret.md').write_text('outside')
    (workspace / 'escape.md').symlink_to(root / 'secret.md')
    def run(writable):
        requests = [
            {'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'acceptance','version':'1'}}},
            {'jsonrpc':'2.0','method':'notifications/initialized'},
            {'jsonrpc':'2.0','id':2,'method':'tools/list'},
        ]
        calls = [('read_document',{'path':'a.md'}),('read_document',{'path':'../secret.md'}),('read_document',{'path':'escape.md'}),('write_document',{'path':'a.md','content':'bad','revision':'stale'}),('write_document',{'path':'a.md','content':'updated','revision':hashlib.sha256(b'original').hexdigest()})]
        for index, (name, arguments) in enumerate(calls, 3): requests.append({'jsonrpc':'2.0','id':index,'method':'tools/call','params':{'name':name,'arguments':arguments}})
        result = subprocess.run([binary,'--mcp','--workspace',str(workspace)] + (['--allow-write'] if writable else []), input=''.join(json.dumps(r)+'\n' for r in requests), text=True,capture_output=True,timeout=20,check=True)
        responses = {r['id']:r['result'] for r in map(json.loads,result.stdout.splitlines())}
        assert len(responses)==7
        assert responses[4]['isError'] and responses[5]['isError'] and responses[6]['isError']
        assert any(tool['name']=='write_document' for tool in responses[2]['tools']) == writable
        assert bool(responses[7].get('isError')) != writable
        assert (workspace/'a.md').read_text() == ('updated' if writable else 'original')
        return {'transport':'stdio','responses':len(responses),'writeEnabled':writable,'outsideRejected':True,'symlinkRejected':True,'staleRevisionRejected':True}
    report = {'readOnly':run(False),'writeEnabled':run(True)}
pathlib.Path('docs/qa').mkdir(parents=True,exist_ok=True)
pathlib.Path('docs/qa/phase-two-mcp.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
