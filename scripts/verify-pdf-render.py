import os,json,subprocess
from pathlib import Path
import zxingcpp
from PIL import Image
from pypdf import PdfReader
expected=json.loads(Path('tmp/pdfs/expected.json').read_text(encoding='utf8'))
poppler=os.environ.get('PDFTOPPM', 'pdftoppm')
for i,data in enumerate(expected,1):
    path=f'output/pdf/firstfly-test-{i}.pdf'
    reader=PdfReader(path);page=reader.pages[0]
    assert len(reader.pages)==1
    extracted=page.extract_text()
    assert str(data['pnr']) in extracted
    assert data['name'].replace(' ','') in extracted.replace('\n','').replace(' ','')
    fonts=page['/Resources']['/Font'].get_object()
    assert any('/FontFile2' in f.get_object()['/DescendantFonts'][0].get_object()['/FontDescriptor'].get_object() for f in fonts.values() if '/DescendantFonts' in f.get_object())
    assert not page.images, 'PDF must not be a screenshot'
    for dpi in [150,300]:
        prefix=f'tmp/pdfs/sample-{i}-{dpi}'
        subprocess.run([poppler,'-r',str(dpi),'-png','-singlefile',path,prefix],check=True)
        codes=zxingcpp.read_barcodes(Image.open(prefix+'.png'))
        assert len(codes)==2,(i,dpi,len(codes))
        assert all(c.text==data['payload'] for c in codes),(i,dpi,[c.text for c in codes])
    print(f'Sample {i}: text extractable, fonts embedded, vector-only; both QR payloads decoded at 150 and 300 DPI')
