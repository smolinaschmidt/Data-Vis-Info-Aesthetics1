let chartInitialized = false;
let allData = [];
let svg, x, y, color, size, tooltip, width, margin; 

let currentGlobalFilter = 'All';
let currentSearchTerm = '';

const SERIES_ROW_HEIGHT = 24; 

const ROMAN_TO_INT = {
    'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
    'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15, 'XVI': 16, 'XVII': 17, 'XVIII': 18, 'XIX': 19, 'XX': 20,
    'XXI': 21, 'XXII': 22, 'XXIII': 23, 'XXIV': 24, 'XXV': 25, 'XXVI': 26, 'XXVII': 27, 'XXVIII': 28
};
const romanRegex = new RegExp(`\\s+(${Object.keys(ROMAN_TO_INT).join('|')})$`, 'i');


function handleScroll() {
    const wrapper = document.getElementById('chart-wrapper');
    const backButton = document.getElementById('floating-back-button');
    
    if (wrapper.scrollTop > 50) { 
        backButton.classList.remove('hidden');
    } else {
        backButton.classList.add('hidden');
    }
}


function showChart() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('chart-page').classList.remove('hidden');

    const wrapper = document.getElementById('chart-wrapper');
    wrapper.removeEventListener('scroll', handleScroll); 
    wrapper.addEventListener('scroll', handleScroll);
    
    const backButton = document.getElementById('floating-back-button');
    if (backButton) backButton.classList.add('hidden'); 
    
    if (!chartInitialized) {
        createBubbleChart();
        chartInitialized = true;
    } else {
        updateChart(); 
    }
}

function showLanding() {
    document.getElementById('chart-page').classList.add('hidden');
    document.getElementById('landing-page').classList.remove('hidden');
    
    const wrapper = document.getElementById('chart-wrapper');
    if (wrapper) wrapper.removeEventListener('scroll', handleScroll);
    const backButton = document.getElementById('floating-back-button');
    if (backButton) backButton.classList.add('hidden');
}

function getCleanSeriesName(name) {
    return name.trim().replace(/\s*:\s*$/, '').trim(); 
}


function createBubbleChart() {
    margin = { top: 40, right: 10, bottom: 40, left: 250 }; 
    width = 1100 - margin.left - margin.right;
    
    d3.select("#bubble-chart").select("svg").remove();
    svg = d3.select("#bubble-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", 600 + margin.top + margin.bottom) 
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    d3.csv("NETFLIX - Sheet.csv").then(function(rawData) {
        
        const seasonRegex = /(Season|Series|Temporada|第\d+期|Volume|Volumen|Book|Libro)\s*(\d+)/i; 
        const partRegex = /Part\s*(\d+)/i; 
        const yearRegex = /\s*(\d{4})\s*$/; 
        const ordinalSeasonRegex = /(\d+)(?:st|nd|rd|th)\s*(season)/ig; 

        let processedData = rawData
            .filter(d => d.Title && d.Views && d["Available Globally?"])
            .map(d => {
                const total_views_str = d.Views ? d.Views.replace(/,/g, '') : '0';
                const total_views = parseInt(total_views_str) || 0;
                
                let title = d.Title;
                let season = 1;
                let part = 0; 
                let base_series_name = title;

                title = title.replace(ordinalSeasonRegex, (match, number, suffix) => `${number} ${suffix}`);
                base_series_name = title;

                if (base_series_name.includes('//')) {
                    base_series_name = base_series_name.split('//')[0].trim();
                }
                title = base_series_name; 


                const romanMatch = title.match(romanRegex);
                if (romanMatch) {
                    const romanNum = romanMatch[1].toUpperCase();
                    season = ROMAN_TO_INT[romanNum] || 1;
                    base_series_name = base_series_name.replace(romanRegex, '');
                    title = base_series_name; 
                } 
                
                const seasonMatch = title.match(seasonRegex);
                if (seasonMatch) {
                    season = parseInt(seasonMatch[2]);
                    base_series_name = base_series_name.replace(seasonRegex, ''); 
                    title = base_series_name; 
                } 
                
                if (season === 1) {
                    const yearMatch = title.match(yearRegex);
                    if (yearMatch) {
                        season = parseInt(yearMatch[1].substring(2)); 
                        base_series_name = base_series_name.replace(yearRegex, '');
                        title = base_series_name;
                    }
                }
                
                const partMatch = title.match(partRegex);
                if (partMatch) {
                    part = parseInt(partMatch[1]);
                    
                    if (season === 1) { 
                        season = part; 
                    }
                    
                    base_series_name = base_series_name.replace(partRegex, '');
                    title = base_series_name; 
                }
                
                if (season === 1 && d.Title.includes('Remix')) {
                    season = 4;
                }


                base_series_name = base_series_name.replace(/\s*\([^)]*\)/g, '').trim();

                base_series_name = base_series_name.replace(/\s*:\s*:\s*/g, ': ').trim(); 

                if (base_series_name.includes(':')) {
                    const colonIndex = base_series_name.indexOf(':');
                    base_series_name = base_series_name.substring(0, colonIndex).trim();
                }

                base_series_name = base_series_name.replace(/[^a-zA-Z0-9\s&]/g, ' ').replace(/\s+/g, ' ').trim();
                
                const final_series_name = getCleanSeriesName(base_series_name);
                
                const global_availability = (d["Available Globally?"] && d["Available Globally?"].toUpperCase().startsWith("Y")) ? "Yes" : "No";

                return {
                    series_name: final_series_name, 
                    original_title: d.Title,       
                    season: season,
                    part: part,
                    total_views: total_views,
                    hours_viewed_str: d["Hours Viewed"] ? d["Hours Viewed"].replace(/,/g, '') : '0',
                    global_availability: global_availability
                };
            })
            .filter(d => d.season >= 1 && d.season <= 28); 


        
        const groupedBySeason = d3.groups(processedData, d => d.series_name, d => d.season);
        
        allData = groupedBySeason.flatMap(([seriesName, seasons]) => 
            seasons.map(([seasonNumber, parts]) => {
                
                const totalViewsSum = d3.sum(parts, d => d.total_views);
                const totalHoursSum = d3.sum(parts, d => parseInt(d.hours_viewed_str));

                const firstPart = parts[0];

                return {
                    series_name: seriesName,
                    season: seasonNumber,
                    total_views: totalViewsSum, 
                    total_hours: totalHoursSum,
                    global_availability: firstPart.global_availability,
                    combined_titles: parts.map(p => p.original_title).join(' | ') 
                };
            })
        )
        .sort((a, b) => d3.ascending(a.series_name, b.series_name));


        color = d3.scaleOrdinal()
            .domain(["Yes", "No"])
            .range(["#E50914", "#E5E5E5"]); 

        const maxViews = d3.max(allData, d => d.total_views) || 1;
        size = d3.scalePow()
            .exponent(0.75)           
            .domain([0, maxViews])
            .range([6, 90])          
            .clamp(true);
 
        tooltip = d3.select("body").append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);
        
        updateChart(); 
    }).catch(function(error) {
        console.error("Error loading or processing CSV data:", error);
        d3.select("#bubble-chart").html("<p style='color:#E50914; text-align:center;'>Error loading data. Please check the 'NETFLIX - Sheet.csv' file and its format.</p>");
    });
}

function drawAxes(dataToDraw) {
    svg.selectAll(".axis").remove();
    svg.selectAll(".label").remove();
    
    
    const uniqueSeriesNames = Array.from(new Set(dataToDraw.map(d => d.series_name))).sort();
    
    const requiredHeight = uniqueSeriesNames.length * SERIES_ROW_HEIGHT;
    
    d3.select("#bubble-chart svg")
        .attr("height", requiredHeight + margin.top + margin.bottom);
    
    y = d3.scaleBand()
        .domain(uniqueSeriesNames) 
        .range([0, requiredHeight])
        .padding(0.1);


    svg.append("g")
        .attr("class", "axis x-axis")
        .attr("transform", `translate(0, 0)`) 
        .call(d3.axisTop(x).tickFormat(d => d)) 
        .selectAll("text")
        .style("fill", "#B3B3B3")
        .style("font-size", "16px"); 

    svg.append("g")
        .attr("class", "axis y-axis")
        .call(d3.axisLeft(y).tickSize(0))
        .selectAll("text")
        .style("fill", "#E5E5E5") 
        .style("font-size", "13px") 
        .call(wrapText, margin.left - 10); 

    function wrapText(text, width) {
        text.each(function() {
            let text = d3.select(this),
                words = text.text().split(/\s+/).reverse(),
                word,
                line = [],
                lineNumber = 0,
                lineHeight = 1.1, 
                y = text.attr("y"),
                dy = parseFloat(text.attr("dy")),
                tspan = text.text(null).append("tspan").attr("x", -5).attr("y", y).attr("dy", dy + "em");
                
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if (tspan.node().getComputedTextLength() > width && lineNumber < 1) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    lineNumber++;
                    tspan = text.append("tspan").attr("x", -5).attr("y", y).attr("dy", lineNumber * lineHeight + dy + "em").text(word);
                } else if (tspan.node().getComputedTextLength() > width && lineNumber >= 1) {
                    let currentText = tspan.text();
                    while (tspan.node().getComputedTextLength() > width - 15) {
                        currentText = currentText.slice(0, -1);
                        tspan.text(currentText + "...");
                    }
                    break;
                }
            }
        });
    }

    svg.selectAll(".domain").remove();

}

function updateChart(filterType, filterValue, button) {
    if (filterType === 'GlobalFilter') {
        currentGlobalFilter = filterValue;
        document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
        if (currentGlobalFilter === 'All' && button) {
             button.classList.add('active');
             document.getElementById('global-filter').value = 'All'; 
        } else if (currentGlobalFilter !== 'All') {
            document.getElementById('all-filter-button').classList.remove('active');
        }
    } else if (filterType === 'Search') {
        currentSearchTerm = filterValue.toLowerCase().trim();
        currentGlobalFilter = document.getElementById('global-filter').value;
    }
    
    if (!filterType) {
        currentGlobalFilter = document.getElementById('global-filter').value;
        currentSearchTerm = document.getElementById('series-search').value.toLowerCase().trim();
        document.getElementById('all-filter-button').classList.add('active');
    }

    let filteredData = allData;
    
    if (currentGlobalFilter !== 'All') {
        filteredData = filteredData.filter(d => d.global_availability === currentGlobalFilter);
        document.getElementById('all-filter-button').classList.remove('active'); 
    } else if (currentGlobalFilter === 'All' && !document.getElementById('all-filter-button').classList.contains('active')) {
        document.getElementById('all-filter-button').classList.add('active');
    }
    
    if (currentSearchTerm) {
        filteredData = filteredData.filter(d => 
            d.series_name.toLowerCase().includes(currentSearchTerm) || 
            d.combined_titles.toLowerCase().includes(currentSearchTerm)
        );
    }
    
    if (filteredData.length === 0) {
        d3.select("#bubble-chart").select("svg").remove();
        d3.select("#chart-wrapper").selectAll("#no-results").data([1]).join(
            enter => enter.append("p")
                .attr("id", "no-results")
                .style("color", "#E50914")
                .style("text-align", "center")
                .style("font-size", "1.5em")
                .text("No series found matching the current filters.")
        );
        return; 
    } else {
        d3.select("#chart-wrapper").select("#no-results").remove();
        if (d3.select("#bubble-chart").select("svg").empty()) {
            createBubbleChart();
        }
    }
    
    let maxSeason = 28;
    
    const uniqueSeriesAfterSearch = Array.from(new Set(filteredData.map(d => d.series_name)));
    
    if (currentSearchTerm.length > 0 && uniqueSeriesAfterSearch.length === 1) {
         maxSeason = d3.max(filteredData, d => d.season);
         maxSeason = Math.max(1, maxSeason); 
    } else {
        maxSeason = 28; 
    }

    const seasonDomain = d3.range(1, maxSeason + 1);
    
    x = d3.scaleBand()
        .domain(seasonDomain)
        .range([0, width])
        .padding(0.1);
    
    filteredData.sort((a, b) => d3.ascending(a.series_name, b.series_name));

    drawAxes(filteredData);

    
    const circles = svg.selectAll(".dot")
        .data(filteredData, d => d.series_name + d.season); 

    circles.exit()
        .transition().duration(500)
        .attr("r", 0)
        .remove();

    circles.enter()
        .append("circle")
        .attr("class", "dot")
        .attr("r", 0)
        .style("fill", d => color(d.global_availability))
        .style("opacity", 0.7)
        .attr("stroke", "#000")
        .attr("stroke-width", d => Math.max(0.6, size(d.total_views) * 0.04))
        .merge(circles) 
        .on("mouseover", function(event, d) {
            d3.select(this)
                .style("stroke", "#E50914") 
                .style("stroke-width", 2);

            tooltip.html(`
                <strong>Series:</strong> ${d.series_name}<br>
                <strong>Season:</strong> ${d.season}<br>
                <strong>Total Views:</strong> <strong>${d3.format(",")(d.total_views)}</strong><br>
            `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px")
                .transition()
                .duration(200)
                .style("opacity", .9);
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 15) + "px")
                   .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
            d3.select(this)
                .style("stroke", "#000")
                .attr("stroke-width", d => Math.max(0.6, size(d.total_views) * 0.04)); 
            tooltip.transition()
                .duration(500)
                .style("opacity", 0);
        })
        .transition().duration(700)
        .attr("cx", d => x(d.season) + x.bandwidth() / 2)
        .attr("cy", d => y(d.series_name) + y.bandwidth() / 2)
        .attr("r", d => size(d.total_views));
}