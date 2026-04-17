
(function () {
  const container = document.getElementById("chart-scatter");
  const tooltip = document.getElementById("scatter-tooltip");
  const genreSelect = document.getElementById("scatter-genre");
  const voteSlider = document.getElementById("scatter-votes");
  const voteLabel = document.getElementById("scatter-votes-label");
  if (!container || !tooltip) return;

  const margin = { top: 24, right: 24, bottom: 48, left: 56 };
  const width = Math.min(860, container.clientWidth || 860);
  const height = 340;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", width)
    .attr("height", height);

  const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const color = d3.scaleOrdinal(d3.schemeTableau10);

  function showTip(ev, d) {
    tooltip.style.opacity = 1;
    tooltip.style.left = ev.clientX + 12 + "px";
    tooltip.style.top = ev.clientY + 12 + "px";
    tooltip.innerHTML =
      "<strong>" +
      (d.title || "") +
      "</strong><br/>" +
      "Budget: $" +
      d3.format(",.0f")(d.budget) +
      "<br/>" +
      "Revenue: $" +
      d3.format(",.0f")(d.revenue) +
      "<br/>" +
      "Rating: " +
      d.vote_average +
      " (" +
      d.vote_count +
      " votes)<br/>" +
      "Genre: " +
      d.genre;
  }

  function hideTip() {
    tooltip.style.opacity = 0;
  }

  d3.json("assets/generated/budget_revenue_points.json")
    .then((raw) => {
      const data = raw.filter((d) => d.budget > 0 || d.revenue > 0);
      const genres = Array.from(new Set(data.map((d) => d.genre))).sort((a, b) => a.localeCompare(b));
      genres.forEach((g) => {
        const opt = document.createElement("option");
        opt.value = g;
        opt.textContent = g;
        genreSelect.appendChild(opt);
      });

      const x = d3.scaleLog().range([0, innerW]);
      const y = d3.scaleLog().range([innerH, 0]);

      const xAxis = g.append("g").attr("class", "axis").attr("transform", `translate(0,${innerH})`);
      const yAxis = g.append("g").attr("class", "axis");

      g.append("text").attr("x", innerW / 2).attr("y", innerH + 40).attr("text-anchor", "middle").attr("fill", "#415a77").style("font-size", "11px").text("Budget + 1 (USD, log scale; +1 so zeros plot)");

      g.append("text").attr("transform", "rotate(-90)").attr("y", -40).attr("x", -innerH / 2).attr("text-anchor", "middle").attr("fill", "#415a77").style("font-size", "11px").text("Revenue + 1 (USD, log scale)");

      g.append("text").attr("x", 0).attr("y", -8).attr("fill", "#0d1b2a").style("font-size", "14px").style("font-weight", "600").text("Budget vs. revenue (profitable-volume films)");

      const countLabel = g
        .append("text")
        .attr("x", innerW)
        .attr("y", -8)
        .attr("text-anchor", "end")
        .attr("fill", "#415a77")
        .style("font-size", "11px");

      const dots = g.append("g").attr("class", "dots");
      const regLayer = g.append("path").attr("class", "regression-line").attr("fill", "none").attr("stroke", "#c1121f").attr("stroke-width", 2.5).attr("stroke-linejoin", "round");

      function bx(d) {
        return d.budget + 1;
      }
      function ry(d) {
        return d.revenue + 1;
      }

      function logLogRegression(points) {
        const xs = points.map((d) => Math.log10(bx(d)));
        const ys = points.map((d) => Math.log10(ry(d)));
        const n = xs.length;
        const mx = d3.mean(xs);
        const my = d3.mean(ys);
        let num = 0;
        let den = 0;
        for (let i = 0; i < n; i++) {
          const dx = xs[i] - mx;
          num += dx * (ys[i] - my);
          den += dx * dx;
        }
        const slope = den === 0 ? 0 : num / den;
        const intercept = my - slope * mx;
        return { slope, intercept };
      }

      function update() {
        const gval = genreSelect.value;
        const minVotes = +voteSlider.value;
        voteLabel.textContent = minVotes;

        const filtered = data.filter((d) => {
          if (gval && gval !== "all" && d.genre !== gval) return false;
          if (d.vote_count < minVotes) return false;
          return true;
        });

        countLabel.text(
          `Showing ${filtered.length.toLocaleString()} of ${data.length.toLocaleString()} titles (budget > 0 or revenue > 0 in the 10k sample)`
        );

        const bExtent = d3.extent(filtered, (d) => bx(d));
        const rExtent = d3.extent(filtered, (d) => ry(d));
        if (!bExtent[0] || !rExtent[0] || filtered.length === 0) {
          dots.selectAll("circle").remove();
          regLayer.attr("d", null);
          return;
        }
        x.domain([Math.max(1, bExtent[0]), bExtent[1]]).nice();
        y.domain([Math.max(1, rExtent[0]), rExtent[1]]).nice();

        xAxis.call(d3.axisBottom(x).ticks(5, "~s"));
        yAxis.call(d3.axisLeft(y).ticks(5, "~s"));

        const sel = dots.selectAll("circle").data(filtered, (d, i) => d.title + "-" + d.budget + "-" + d.revenue + "-" + i);

        sel.join(
          (enter) =>
            enter
              .append("circle")
              .attr("r", 5)
              .attr("fill", (d) => color(d.genre))
              .attr("fill-opacity", 0.75)
              .attr("stroke", "#fff")
              .attr("stroke-width", 1)
              .attr("cx", (d) => x(bx(d)))
              .attr("cy", (d) => y(ry(d)))
              .on("mousemove", (ev, d) => showTip(ev, d))
              .on("mouseleave", hideTip),
          (update) => update.attr("cx", (d) => x(bx(d))).attr("cy", (d) => y(ry(d))),
          (exit) => exit.remove()
        );

        if (filtered.length >= 2) {
          const { slope, intercept } = logLogRegression(filtered);
          const b0 = Math.max(1, bExtent[0]);
          const b1 = bExtent[1];
          const logRev = (bPlus1) => intercept + slope * Math.log10(bPlus1);
          const r0 = Math.pow(10, logRev(b0));
          const r1 = Math.pow(10, logRev(b1));
          regLayer.attr("d", `M${x(b0)},${y(r0)}L${x(b1)},${y(r1)}`).style("display", null);
        } else {
          regLayer.attr("d", null).style("display", "none");
        }
      }

      genreSelect.addEventListener("change", update);
      voteSlider.addEventListener("input", update);
      update();
    })
    .catch((err) => {
      container.textContent = "Could not load budget_revenue_points.json.";
      console.error(err);
    });
})();
