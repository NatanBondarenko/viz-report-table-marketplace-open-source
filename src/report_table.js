// const { LookerDataTable } = require('vis-tools') 
const { LookerDataTable } = require('../../vis-tools/looker_data_table.js')
const d3 = require('d3')

import './report_table.css';


const options = {
  columnOrder: {},
  subtotalDepth: {
    section: "Table",
    type: "number",
    label: "Sub Total Depth",
    default: 1
  },
  indexColumn: {
    section: "Table",
    type: "boolean",
    label: "Use Index Dimension",
    default: "false",
  },
  useHeadings: {
    section: "Table",
    type: "boolean",
    label: "Use Headings from field tags",
    default: "false",
  },
  sortColumnsBy: {
    section: "Table",
    type: "string",
    display: "select",
    label: "Sort Columns By",
    values: [
      { 'Pivots': 'getSortByPivots' },
      { 'Measures': 'getSortByMeasures' }
    ],
    default: "getSortByPivots",
  },
  spanRows: {
    section: "Table",
    type: "boolean",
    label: "Span Rows",
    display_size: 'half',
    default: "true",
  },
  spanCols: {
    section: "Table",
    type: "boolean",
    label: "Span Cols",
    display_size: 'half',
    default: "true",
  },
  rowSubtotals: {
    section: "Table",
    type: "boolean",
    label: "Row Subtotals",
    display_size: 'half',
    default: "true",
  },
  colSubtotals: {
    section: "Table",
    type: "boolean",
    label: "Col Subtotals",
    display_size: 'half',
    default: "true",
  },
}

/**
 * Builds new config object based on available dimensions and measures
 * @param {*} table 
 */
const getNewConfigOptions = function(table) {
  var newOptions = options;

  for (var i = 0; i < table.dimensions.length; i++) {
    newOptions['label|' + table.dimensions[i].name] = {
      section: 'Dimensions',
      type: 'string',
      label: table.dimensions[i].label,
      default: table.dimensions[i].label,
      order: i * 10 + 1,
    }

    newOptions['hide|' + table.dimensions[i].name] = {
      section: 'Dimensions',
      type: 'boolean',
      label: 'Hide',
      display_size: 'third',
      order: i * 10 + 2,
    }
  }

  for (var i = 0; i < table.measures.length; i++) {
    newOptions['label|' + table.measures[i].name] = {
      section: 'Measures',
      type: 'string',
      label: table.measures[i].label_short || table.measures[i].label,
      default: table.measures[i].label_short || table.measures[i].label,
      order: 100 + i * 10 + 1,
    }

    newOptions['style|' + table.measures[i].name] = {
      section: 'Measures',
      type: 'string',
      label: 'Style',
      display: 'select',
      values: [
        {'Normal': 'normal'},
        {'Black/Red': 'black_red'},
        {'Hide': 'hide'}
      ],
      order: 100 + i * 10 + 2
    }

    var comparisonOptions = []
    // pivoted measures
    if (table.measures[i].can_pivot) {
      var pivotComparisons = []
      for (var p = 0; p < table.pivot_fields.length; p++) {
        var option = {}
        option['By ' + table.pivot_fields[p]] = table.pivot_fields[p]
        pivotComparisons.push(option)
      }
      comparisonOptions = comparisonOptions.concat(pivotComparisons)
    }
    // row totals and supermeasures
    for (var j = 0; j < table.measures.length; j++) {
      var includeMeasure = table.measures[i].can_pivot === table.measures[j].can_pivot
                            || 
                          table.has_row_totals && !table.measures[j].is_table_calculation         
      if (i != j && includeMeasure) {
        var option = {}
        option['vs. ' + table.measures[j].label] = table.measures[j].name
        comparisonOptions.push(option)
      }
    }
    comparisonOptions.unshift({ '(none)': 'no_variance'})

    newOptions['comparison|' + table.measures[i].name] = {
      section: 'Measures',
      type: 'string',
      label: 'Comparison', // for ' + ( table.measures[i].label_short || table.measures[i].label ),
      display: 'select',
      values: comparisonOptions,
      order: 100 + i * 10 + 5
    }

    newOptions['switch|' + table.measures[i].name] = {
      section: 'Measures',
      type: 'boolean',
      label: 'Switch',
      display_size: 'third',
      order: 100 + i * 10 + 6,
    }

    newOptions['var_num|' + table.measures[i].name] = {
      section: 'Measures',
      type: 'boolean',
      label: 'Var #',
      display_size: 'third',
      order: 100 + i * 10 + 7,
    }

    newOptions['var_pct|' + table.measures[i].name] = {
      section: 'Measures',
      type: 'boolean',
      label: 'Var %',
      display_size: 'third',
      order: 100 + i * 10 + 8,
    }
  }
  return newOptions
}

const buildReportTable = function(config, lookerDataTable, callback) {
  var dropTarget = null;
  
  var table = d3.select('#visContainer')
    .append('table')
    .attr('class', 'reportTable');

  var drag = d3.drag()
    .on('start', (source, idx) => {
      // console.log('drag start', source, idx)
      if (!lookerDataTable.has_pivots) {
        var xPosition = parseFloat(d3.event.x);
        var yPosition = parseFloat(d3.event.y);

        d3.select("#tooltip")
            .style("left", xPosition + "px")
            .style("top", yPosition + "px")                     
            .html();
   
        d3.select("#tooltip").classed("hidden", false);        
      }
    })
    .on('drag', (source, idx) => {
      // console.log('drag drag', source, idx, d3.event.x, d3.event.y)
      if (!lookerDataTable.has_pivots) {
        d3.select("#tooltip") 
          .style("left", d3.event.x + "px")
          .style("top", d3.event.y + "px")  
      }
      
    })
    .on('end', (source, idx) => {
      if (!lookerDataTable.has_pivots) {
        d3.select("#tooltip").classed("hidden", true);
        var movingColumn = lookerDataTable.getColumnById(source.id)
        var targetColumn = lookerDataTable.getColumnById(dropTarget.id)
        var movingIdx = Math.floor(movingColumn.pos/10) * 10
        var targetIdx = Math.floor(targetColumn.pos/10) * 10
        console.log('DRAG FROM', movingColumn, movingIdx, 'to', targetColumn, targetIdx)
        lookerDataTable.moveColumns(config, movingIdx, targetIdx, callback)
      }
    })

  table.append('thead')
    .selectAll('tr')
    .data(lookerDataTable.getLevels()).enter() 
      .append('tr')
      .selectAll('th')
      .data(function(level, i) { 
        return lookerDataTable.getColumnsToDisplay(i).map(function(column) {
          var header = {
            'id': column.id,
            'text': '',
            'align': column.align,
            'colspan': column.colspans[i]
          }
          if (lookerDataTable.useHeadings && !lookerDataTable.has_pivots) {
            if (i == 0) {
              header.text = column.heading
              header.align  = 'center'
            } else {
              header.text = column.short_name || column.getLabel()
            }
          } else {
            if (lookerDataTable.sortColsBy == 'getSortByPivots') {
              if (i < column.levels.length && column.pivoted) {
                header.text = column.levels[i]
              } else if (i === column.levels.length) {
                header.text = column.getLabel()
              } else {
                header.text = ''
              }
            } else {
              if (i == 0) {
                header.text = column.getLabel()
              } else {
                header.text = column.levels[i - 1]
              }
            }
          }
          
          return header
        })
      }).enter()
          .append('th')
          .text(d => d.text)
          .attr('id', d => d.id)
          .attr('colspan', d => d.colspan)
          .attr('class', d => {
            var classes = []
            if (typeof d.align !== 'undefined') { classes.push(d.align) }
            return classes.join(' ')
          })
          .attr('draggable', true)
          .call(drag)
          .on('mouseover', cell => dropTarget = cell)
          .on('mouseout', () => dropTarget = null)
  
  table.append('tbody')
    .selectAll('tr')
    .data(lookerDataTable.data).enter()
      .append('tr')
      .selectAll('td')
      .data(function(row) {  
        return lookerDataTable.getRow(row).map(function(column) {
          var cell = row.data[column.id]
          cell.rowspan = column.rowspan
          cell.align = column.align
          return cell;
        })
      }).enter()
        .append('td')
          .text(d => d.rendered || d.value) 
          .attr('rowspan', d => d.rowspan)
          .attr('class', d => {
            var classes = []
            if (typeof d.align !== 'undefined') { classes.push(d.align) }
            if (typeof d.cell_style !== 'undefined') { 
              classes = classes.concat(d.cell_style) 
            }
            return classes.join(' ')
          })
}

looker.plugins.visualizations.add({
  options: options,

  create: function(element, config) {
    this.tooltip = d3.select(element)
        .append("div")
        .attr("class", "hidden")
        .attr("id", "tooltip")
  },

  updateAsync: function(data, element, config, queryResponse, details, done) {
    const updateColumnOrder = newOrder => {
      console.log('updateColumnOrder()', JSON.stringify(newOrder, null, 2))
      this.trigger('updateConfig', [{columnOrder: newOrder}])
    }

    this.clearErrors();

    // console.log('data', data)
    console.log('config', config)
    // console.log('queryResponse', queryResponse)

    if (queryResponse.fields.pivots.length > 2) {
      this.addError({
        title: 'Max Two Pivots',
        message: 'This visualization accepts no more than 2 pivot fields.'
      });
      return
    }

    try {
      var elem = document.querySelector('#visContainer');
      elem.parentNode.removeChild(elem);  
    } catch(e) {}    

    this.container = d3.select(element)
      .append('div')
      .attr('id', 'visContainer')

    if (typeof config.columnOrder === 'undefined') {
      this.trigger('updateConfig', [{ columnOrder: {} }])
    }
    var lookerDataTable = new LookerDataTable(data, queryResponse, config)
    console.log(lookerDataTable)

    var new_options = getNewConfigOptions(lookerDataTable)
    this.trigger('registerOptions', new_options)

    buildReportTable(config, lookerDataTable, updateColumnOrder)

    done();
  }
})