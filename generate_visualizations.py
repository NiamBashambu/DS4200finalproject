"""
Generate figures and data for the DS4200 TMDB movie project website.
Run from project root: python3 generate_visualizations.py
Requires: pandas, altair, matplotlib, seaborn
"""
from __future__ import annotations

import json
from pathlib import Path

import altair as alt
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

ROOT = Path(__file__).resolve().parent
CSV_PATH = ROOT / "TMDB_movie_dataset_v11_10000.csv"
OUT = ROOT / "docs" / "assets" / "generated"
THEME = "#1a535c"
ACCENT = "#ff6b35"
ACCENT2 = "#4ecdc4"


def load_data() -> pd.DataFrame:
    df = pd.read_csv(CSV_PATH)
    df["release_date"] = pd.to_datetime(df["release_date"], errors="coerce")
    df["year"] = df["release_date"].dt.year
    return df


def explode_genres(df: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for _, r in df.iterrows():
        g = r.get("genres")
        if pd.isna(g) or not str(g).strip():
            continue
        for part in str(g).split(","):
            part = part.strip()
            if part:
                rows.append({"genre": part, "title": r.get("title")})
    return pd.DataFrame(rows)


def save_year_counts(df: pd.DataFrame) -> None:
    vc = df.dropna(subset=["year"]).loc[lambda d: (d["year"] >= 1920) & (d["year"] <= 2025)]
    counts = vc.groupby("year").size().reset_index(name="count")
    payload = [{"year": int(r.year), "count": int(r.count)} for r in counts.itertuples()]
    (OUT / "year_counts.json").write_text(json.dumps(payload), encoding="utf-8")


def save_scatter_points(df: pd.DataFrame) -> None:
    sub = df[(df["budget"] > 0) & (df["revenue"] > 0)].copy()
    sub = sub.head(2000)  # keep page light
    sub["primary_genre"] = sub["genres"].fillna("Unknown").str.split(",").str[0].str.strip()
    records = []
    for _, r in sub.iterrows():
        records.append(
            {
                "title": str(r.get("title", ""))[:80],
                "budget": float(r["budget"]),
                "revenue": float(r["revenue"]),
                "vote_average": float(r["vote_average"]),
                "vote_count": int(r["vote_count"]),
                "year": int(r["year"]) if pd.notna(r["year"]) else None,
                "genre": r["primary_genre"] or "Unknown",
            }
        )
    (OUT / "budget_revenue_points.json").write_text(json.dumps(records), encoding="utf-8")


def altair_top_genres(gen_df: pd.DataFrame) -> None:
    top = gen_df["genre"].value_counts().head(12).reset_index()
    top.columns = ["genre", "movies"]
    chart = (
        alt.Chart(top)
        .mark_bar(cornerRadiusEnd=4, color=THEME)
        .encode(
            x=alt.X("movies:Q", title="Number of films (genre tags)"),
            y=alt.Y("genre:N", sort="-x", title="Genre"),
            tooltip=["genre", "movies"],
        )
        .properties(width=520, height=320, title="Top genres in the sample")
        .configure_axis(labelFontSize=11, titleFontSize=12)
        .configure_title(fontSize=16, anchor="start", color="#0d1b2a")
    )
    chart.save(str(OUT / "altair_genres.png"), scale_factor=2)
    chart.save(str(OUT / "altair_genres.html"))


def altair_runtime_hist(df: pd.DataFrame) -> None:
    run = df[(df["runtime"] > 0) & (df["runtime"] < 400)]["runtime"]
    data = run.to_frame(name="runtime")
    brush = alt.selection_interval(encodings=["x"], empty="all")
    base = (
        alt.Chart(data)
        .mark_bar(cornerRadius=2, color=ACCENT2)
        .encode(
            alt.X("runtime:Q", bin=alt.Bin(maxbins=35), title="Runtime (minutes)"),
            alt.Y("count():Q", title="Count"),
        )
    )
    upper = base.add_params(brush).properties(width=560, height=260, title="Runtime distribution (brush to filter)")
    lower = (
        alt.Chart(data)
        .mark_area(color=THEME, opacity=0.4)
        .encode(
            alt.X("runtime:Q", bin=alt.Bin(maxbins=35), title="Runtime (minutes)"),
            alt.Y("count():Q", title=""),
        )
        .transform_filter(brush)
        .properties(width=560, height=120, title="Zoomed view (same brush)")
    )
    combined = upper & lower
    combined.save(str(OUT / "altair_runtime_brush.html"))


def matplotlib_correlation_heatmap(df: pd.DataFrame) -> None:
    num = df[
        ["vote_average", "vote_count", "revenue", "runtime", "popularity", "budget"]
    ].replace(0, np.nan)
    num = num.apply(lambda s: np.log1p(s) if s.name in ("revenue", "budget", "vote_count", "popularity") else s)
    corr = num.corr()
    plt.figure(figsize=(7, 5.5))
    cmap = sns.diverging_palette(200, 30, as_cmap=True)
    sns.heatmap(
        corr,
        annot=True,
        fmt=".2f",
        cmap=cmap,
        square=True,
        linewidths=0.5,
        cbar_kws={"shrink": 0.75},
    )
    plt.title("Log-scaled associations (numeric TMDB fields)", pad=12)
    plt.tight_layout()
    plt.savefig(OUT / "heatmap_correlation.png", dpi=160, bbox_inches="tight")
    plt.close()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    df = load_data()
    gen_df = explode_genres(df)

    save_year_counts(df)
    save_scatter_points(df)
    altair_top_genres(gen_df)
    altair_runtime_hist(df)
    matplotlib_correlation_heatmap(df)

    meta = {
        "n_rows": int(len(df)),
        "n_genre_tags": int(len(gen_df)),
        "year_min": int(df["year"].min()) if df["year"].notna().any() else None,
        "year_max": int(df["year"].max()) if df["year"].notna().any() else None,
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Wrote assets to {OUT}")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
