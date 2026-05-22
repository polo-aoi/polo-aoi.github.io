#!/bin/bash
cd "$(dirname "$0")"
open http://localhost:8888/editor
python3 server.py
