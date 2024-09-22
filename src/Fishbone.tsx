import React from "react";
import * as d3 from "d3";
import { FishboneProps, LineConfig, NodeConfig } from "./Fishbone.types";
import { v4 as uuidv4 } from "uuid";

type Connector = {
  between: (Node | Connector)[];
  childIdx?: number;
  index?: number;
  maxChildIdx?: number;
  totalLinks: Link[];
  vx: number;
  vy: number;
  x: number;
  y: number;
};

type Node = {
  index?: number;
  childIdx?: number;
  depth?: number;
  horizontal?: boolean;
  linkCount?: number;
  name: string;
  parent?: Node;
};

type Link = {
  index?: number;
  depth?: number; // Might not be undefined
  arrow?: boolean;
  source?: unknown;
  target?: unknown;
};

const arrowElementId = "#arrow";
const margin = 50;

const Fishbone = (props: FishboneProps) => {
  const {
    width = "100%",
    height = "100%",
    items = [],
    linesConfig = [
      {
        color: "#00b3f6",
        strokeWidthPx: 2,
      },
      {
        color: "#00b3f6",
        strokeWidthPx: 1,
      },
      {
        color: "#00b3f6",
        strokeWidthPx: 0.5,
      },
    ],
    nodesConfig = [
      {
        color: "white",
        fontSizeEm: 2,
      },
      {
        color: "white",
        fontSizeEm: 1.5,
      },
      {
        color: "black",
        fontSizeEm: 1,
      },
      {
        color: "#00b3f6",
        fontSizeEm: 0.8,
      },
      {
        color: "#aaa",
        fontSizeEm: 0.8,
      },
    ],
    wrapperStyle,
  } = props;

  const ref = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const lineConfigWithoutOverflow = React.useCallback(
    (index: number | undefined): LineConfig => {
      if (!index || index < 0) return linesConfig[0];

      const maxIndex = linesConfig.length - 1;

      return linesConfig[
        // Minimum of `total` and `maxIndex`
        maxIndex ^ ((index ^ maxIndex) & -(index < maxIndex))
      ];
    },
    [linesConfig]
  );

  const nodeConfigWithoutOverflow = React.useCallback(
    (index: number | undefined): NodeConfig => {
      if (!index || index < 0) return nodesConfig[0];

      const maxIndex = nodesConfig.length - 1;

      return nodesConfig[
        // Minimum of `total` and `maxINdex`
        maxIndex ^ ((index ^ maxIndex) & -(index < maxIndex))
      ];
    },
    [nodesConfig]
  );

  const perNodeTick = (d: unknown) => undefined;

  const linkScale = d3.scaleLog().domain([1, 5]).range([60, 30]);

  const initialize = () => {
    const nodes: any[] = [];
    const links: any[] = [];
    let node: any, link: any, root: any;

    let force: d3.Simulation<any, undefined> | undefined;

    const svg = d3
      .select(ref.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .datum(items);

    const defs = svg.append("defs").data([1]);

    const svgElement = svg.selection().node();

    const svgWidth = () => svgElement?.clientWidth || 0;
    const svgHeight = () => svgElement?.clientHeight || 0;

    function buildNodes(node: any) {
      nodes.push(node);

      let cx = 0;
      let between = [node, node.connector];

      const nodeLinks = [
        {
          source: node,
          target: node.connector,
          arrow: true,
          depth: node.depth || 0,
        },
      ];

      let prev: any;
      let childLinkCount;

      if (!node.parent) {
        nodes.push((prev = { tail: true }));
        between = [prev, node];
        nodeLinks[0].source = prev;
        nodeLinks[0].target = node;
        node.horizontal = true;
        node.vertical = false;
        node.depth = 0;
        node.root = true;
        node.totalLinks = [];
      } else {
        node.connector.maxChildIdx = 0;
        node.connector.totalLinks = [];
      }

      node.linkCount = 1;

      (node.children || []).forEach(function (child: any, idx: number) {
        child.parent = node;
        child.depth = (node.depth || 0) + 1;
        child.childIdx = idx;
        child.region = node.region ? node.region : idx & 1 ? 1 : -1;
        child.horizontal = !node.horizontal;
        child.vertical = !node.vertical;

        if (node.root && prev && !prev.tail) {
          nodes.push(
            (child.connector = {
              between: between,
              childIdx: prev.childIdx,
            })
          );
          prev = null;
        } else {
          nodes.push(
            (prev = child.connector = { between: between, childIdx: cx++ })
          );
        }

        nodeLinks.push({
          source: child,
          target: child.connector,
          depth: child.depth,
          arrow: false,
        });

        childLinkCount = buildNodes(child);
        node.linkCount += childLinkCount;
        between[1].totalLinks.push(childLinkCount);
      });

      between[1].maxChildIdx = cx;

      Array.prototype.unshift.apply(links, nodeLinks);

      return node.linkCount;
    }

    function tick() {
      // TODO: Do we need it?
      if (isDragging) return;

      const alpha = force?.alpha();

      const k = 6 * (alpha || 0);
      const width = svgWidth();
      const height = svgHeight();

      let a;
      let b;

      nodes.forEach(function (d) {
        if (d.root) {
          d.x = width - (margin + root.getBBox().width);
        }
        if (d.tail) {
          d.x = margin;
          d.y = height / 2;
        }

        if (d.depth === 1) {
          d.y = d.region === -1 ? margin : height - margin;
          d.x -= 5 * k;
        }

        if (d.vertical) {
          d.y += k * d.region;
        }

        if (d.depth) {
          d.x -= k;
        }

        if (d.between) {
          a = d.between[0];
          b = d.between[1];

          d.x = b.x - ((1 + d.childIdx) * (b.x - a.x)) / (b.maxChildIdx + 1);
          d.y = b.y - ((1 + d.childIdx) * (b.y - a.y)) / (b.maxChildIdx + 1);
        }
        if (d.depth !== 0) {
          perNodeTick(d);
        }
      });

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);

      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
    }

    const uniqueArrowElementId = arrowElementId || `arrow-${uuidv4()}`;

    defs
      .selectAll(`marker${arrowElementId}`)
      .data([1])
      .enter()
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 0 20 20") // Updated viewBox to fit the larger circle
      .attr("refX", 10) // Center the reference point
      .attr("refY", 10) // Center the reference point
      .attr("markerWidth", 20) // Double the marker width
      .attr("markerHeight", 20) // Double the marker height
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M10,10 m-10,0 a10,10 0 1,0 20,0 a10,10 0 1,0 -20,0") // Draw a larger circle
      .attr("fill", "rgba(255, 255, 255, 0.5)") // Set the background color to white
      .attr("stroke", "#ffbd00") // Set the border color to yellow
      .attr("stroke-width", 3);

    buildNodes(svg.datum());

    force = d3
      .forceSimulation(nodes)
      .nodes(nodes)
      .force(
        "link",
        d3
          .forceLink()
          .id((d: any) => d.id)
          .links(links)
          .distance(
            (d: any) => (d.target.maxChildIdx + 1) * linkScale(d.depth + 1)
          )
      );

    link = svg
      .selectAll(".link")
      .data(links)
      .enter()
      .append("line")
      .attr("class", (d: any) => `link link-${d.depth}`)
      .attr("marker-end", (d: any) =>
        d.arrow ? `url(${arrowElementId})` : null
      )
      .style("stroke", (d: Link) => {
        return lineConfigWithoutOverflow(d.depth).color;
      })
      .style("stroke-width", (d: Link) => {
        const width = lineConfigWithoutOverflow(d.depth).strokeWidthPx;
        return `${width}px`;
      });

    node = svg
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", (d: any) => `node ${d.root ? "root" : ""}`)
      .each(function (this: SVGGElement, d: Node) {
        const g = d3.select(this);

        if (d.depth === 0) {
          // Append circle for background if depth is 0
          g.append("circle")
            .attr("class", `bg-${d.depth}`)
            .style(
              "fill",
              nodeConfigWithoutOverflow(d.depth).backgroundColor || "#00b3f6"
            );
        } else {
          // Append rect for background for other depths
          const rect = g
            .append("rect")
            .attr("class", `bg-${d.depth}`)
            .style(
              "fill",
              nodeConfigWithoutOverflow(d.depth).backgroundColor || "#00b3f6"
            );

          if (d.depth === 2) {
            rect
              .style("fill", "white")
              .style("stroke", "#00b3f6")
              .style("stroke-width", 2); // Adjust border width as needed
          }
        }

        // Append text
        const text = g
          .append("text")
          .attr("class", `label-${d.depth}`)
          .style(
            "font-size",
            `${nodeConfigWithoutOverflow(d.depth).fontSizeEm}em`
          )
          .style("fill", nodeConfigWithoutOverflow(d.depth).color)
          .attr(
            "text-anchor",
            !d.depth ? "start" : d.horizontal ? "end" : "middle"
          )
          .attr("dy", d.horizontal ? ".35em" : d.depth === 1 ? "1em" : "-.2em")
          .text(d.name);

        // Adjust background size to fit text
        const bbox = text.node().getBBox();
        if (d.depth !== 3) {
          if (d.depth === 0) {
            // Adjust circle size to fit text
            const radius = Math.max(bbox.width, bbox.height) / 2 + 4; // Adjust padding as needed
            g.select(`.bg-${d.depth}`)
              .attr("cx", bbox.x + bbox.width / 2)
              .attr("cy", bbox.y + bbox.height / 2)
              .attr("r", radius);
          } else {
            // Adjust rect size to fit text
            g.select(`.bg-${d.depth}`)
              .attr("x", bbox.x - 2) // Adjust padding as needed
              .attr("y", bbox.y - 2)
              .attr("width", bbox.width + 4)
              .attr("height", bbox.height + 4);
          }
        }
      })
      .classed("node", true)
      .classed("fixed", (d: any) => d.fx !== undefined);

    function clamp(x: any, lo: any, hi: any) {
      return x < lo ? lo : x > hi ? hi : x;
    }

    function click(event: any, d: any) {
      delete d.fx;
      delete d.fy;
      d3.select(event.target).classed("fixed", false);
      force?.alpha(1).restart();
    }

    const dragstart = (event: any) => {
      setIsDragging(true);
      d3.select(event.sourceEvent.target).classed("fixed", true);
    };

    function dragged(event: any, d: any) {
      d.fx = clamp(event.x, 0, svgWidth());
      d.fy = clamp(event.y, 0, svgHeight());
      force?.alpha(1).restart();
    }

    const dragend = () => {
      setIsDragging(false);
    };

    const drag = d3
      .drag()
      .on("start", dragstart)
      .on("drag", dragged)
      .on("end", dragend);

    node.call(drag).on("click", click);

    root = svg.select(".root").node();

    force.on("tick", tick);

    d3.select(window).on("resize", function () {
      svg.attr("width", svgWidth()).attr("height", svgHeight());

      const resizeFinished = setTimeout(() => {
        force?.restart();
      }, 200);

      clearTimeout(resizeFinished);
    });
  };

  React.useEffect(() => {
    // Ref is not initialized
    if (ref.current === null) return;
    // Ref was already initialized (Caused by React.StrictMode)
    if (ref.current.children.length !== 0) return;
    // If no items passed - render nothing
    if (!items) return;

    initialize();
  }, [ref, width, height, items, linesConfig, nodesConfig, wrapperStyle]);

  return <div ref={ref} style={wrapperStyle}></div>;
};

export default Fishbone;
