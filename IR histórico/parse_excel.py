import zipfile
import xml.etree.ElementTree as ET
import sys
import re

def clean_tag(tag):
    return re.sub(r'\{.*\}', '', tag)

def parse_xlsx(file_path):
    print(f"--- Parsing {file_path} ---")
    try:
        with zipfile.ZipFile(file_path, 'r') as z:
            # Get shared strings
            shared_strings = []
            if 'xl/sharedStrings.xml' in z.namelist():
                ss_data = z.read('xl/sharedStrings.xml')
                ss_tree = ET.fromstring(ss_data)
                for si in ss_tree:
                    t_nodes = list(si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'))
                    text = "".join([t.text for t in t_nodes if t.text])
                    shared_strings.append(text)
            
            # Find sheets
            sheet_files = [f for f in z.namelist() if f.startswith('xl/worksheets/sheet')]
            for sheet_file in sheet_files:
                sheet_data = z.read(sheet_file)
                sheet_tree = ET.fromstring(sheet_data)
                for row in sheet_tree.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
                    row_data = []
                    for c in row.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                        v_node = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                        if v_node is not None and v_node.text:
                            t = c.get('t')
                            if t == 's':  # shared string
                                try:
                                    idx = int(v_node.text)
                                    row_data.append(shared_strings[idx])
                                except:
                                    row_data.append(v_node.text)
                            else:
                                row_data.append(v_node.text)
                        else:
                            row_data.append("")
                    if any(row_data):
                        print("\t".join(row_data))
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")

parse_xlsx('movimentacao-2026-05-04-02-10-08.xlsx')
parse_xlsx('negociacao-2026-05-04-02-16-48.xlsx')
