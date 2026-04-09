
(function () {
  const container = document.getElementById("chart-timeline");
  if (!container) return;

  const margin = { top: 24, right: 20, bottom: 40, left: 52 };
  const width = Math.min(860, container.clientWidth || 860);
  const heightMain = 260;
  const heightBrush = 70;
  const totalH = heightMain + heightBrush + margin.top + margin.bottom;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${totalH}`)
    .attr("width", width)
    .attr("height", totalH);

  const gMain = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const gBrush = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top + heightMain + 24})`);

  const innerW = width - margin.left - margin.right;

  d3.json("assets/generated/year_counts.json")
    .then((data) => {
      const parse = data.map((d) => ({ year: d.year, count: d.count }));
      const x0 = d3.scaleLinear().domain(d3.extent(parse, (d) => d.year)).range([0, innerW]);
      const yMax = d3.max(parse, (d) => d.count) || 1;
      const y0 = d3.scaleLinear().domain([0, yMax]).nice().range([heightMain, 0]);

      const line = d3
        .line()
        .x((d) => x0(d.year))
        .y((d) => y0(d.count))
        .curve(d3.curveMonotoneX);

      const area = d3
        .area()
        .x((d) => x0(d.year))
        .y0(heightMain)
        .y1((d) => y0(d.count))
        .curve(d3.curveMonotoneX);

      const xAxisMain = gMain.append("g").attr("class", "axis").attr("transform", `translate(0,${heightMain})`);
      const yAxisMain = gMain.append("g").attr("class", "axis");

      const pathLine = gMain.append("path").datum(parse).attr("fill", "none").attr("stroke", "#1a535c").attr("stroke-width", 2).attr("d", line);

      const pathArea = gMain.append("path").datum(parse).attr("fill", "#4ecdc4").attr("fill-opacity", 0.25).attr("d", area);

      function drawAxes(xScale, yScale) {
        xAxisMain.call(d3.axisBottom(xScale).ticks(12).tickFormat(d3.format("d")));
        yAxisMain.call(d3.axisLeft(yScale).ticks(6));
      }

      drawAxes(x0, y0);

      gMain
        .append("text")
        .attr("x", 0)
        .attr("y", -8)
        .attr("fill", "#0d1b2a")
        .style("font-size", "14px")
        .style("font-weight", "600")
        .text("Films in sample by release year");

      gMain
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -38)
        .attr("x", -heightMain / 2)
        .attr("text-anchor", "middle")
        .attr("fill", "#415a77")
        .style("font-size", "11px")
        .text("Count");

      gMain
        .append("text")
        .attr("x", innerW / 2)
        .attr("y", heightMain + 36)
        .attr("text-anchor", "middle")
        .attr("fill", "#415a77")
        .style("font-size", "11px")
        .text("Release year");

      const xBrush = d3.scaleLinear().domain(x0.domain()).range([0, innerW]);
      const yBrush = d3.scaleLinear().domain([0, yMax]).range([heightBrush, 0]);

      const brushLine = d3.line().x((d) => xBrush(d.year)).y((d) => yBrush(d.count)).curve(d3.curveMonotoneX);

      gBrush.append("path").datum(parse).attr("fill", "none").attr("stroke", "#ff6b35").attr("stroke-width", 1.5).attr("d", brushLine);

      gBrush
        .append("g")
        .attr("class", "axis")
        .attr("transform", `translate(0,${heightBrush})`)
        .call(d3.axisBottom(xBrush).ticks(8).tickFormat(d3.format("d")));

      function redrawMain(yearDomain) {
        let filtered =
          yearDomain == null
            ? parse
            : parse.filter((d) => d.year >= yearDomain[0] && d.year <= yearDomain[1]);
        if (filtered.length === 0) {
          filtered = parse;
          yearDomain = null;
        }
        const xDomain = yearDomain ? [yearDomain[0], yearDomain[1]] : d3.extent(parse, (d) => d.year);
        const nx = d3.scaleLinear().domain(xDomain).range([0, innerW]);
        const ymax = d3.max(filtered, (d) => d.count) || 1;
        const ny = d3.scaleLinear().domain([0, ymax]).nice().range([heightMain, 0]);
        const nLine = d3.line().x((d) => nx(d.year)).y((d) => ny(d.count)).curve(d3.curveMonotoneX);
        const nArea = d3
          .area()
          .x((d) => nx(d.year))
          .y0(heightMain)
          .y1((d) => ny(d.count))
          .curve(d3.curveMonotoneX);
        pathLine.datum(filtered).attr("d", nLine);
        pathArea.datum(filtered).attr("d", nArea);
        drawAxes(nx, ny);
      }

      const brush = d3
        .brushX()
        .extent([
          [0, 0],
          [innerW, heightBrush],
        ])
        .on("end", (event) => {
          if (!event.selection) {
            redrawMain(null);
            return;
          }
          const [x1, x2] = event.selection.map(xBrush.invert);
          redrawMain([Math.min(x1, x2), Math.max(x1, x2)]);
        });

      gBrush.append("g").attr("class", "brush").call(brush);
    })
    .catch((err) => {
      container.textContent = "Could not load year_counts.json. Run python3 generate_visualizations.py from the project root.";
      console.error(err);
    });
})();
