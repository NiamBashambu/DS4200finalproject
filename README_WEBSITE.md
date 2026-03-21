# Publishing the project site (GitHub Pages)

1. Commit the `docs/` folder and generated files under `docs/assets/generated/`.
2. On GitHub: **Settings → Pages → Build and deployment → Source**: Deploy from branch **main** and folder **`/docs`**.
3. After the first deploy, open the site at `https://<user>.github.io/<repo>/` (GitHub shows the exact URL on the Pages settings page).
4. Paste that URL into `visualization_design.txt` for your Word document.

**Regenerate charts after changing the CSV or Python script:**

```bash
pip install -r requirements.txt
python3 generate_visualizations.py
```

**Preview locally** (JSON loading needs a local server, not `file://`):

```bash
cd docs && python3 -m http.server 8080
```

Then open `http://localhost:8080`.
