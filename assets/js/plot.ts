/*

  Plot data using Plotly JS

  Gamma MCA: free, open-source web-MCA for gamma spectroscopy
  2022, NuclearPhoenix.- Phoenix1747
  https://nuclearphoenix.xyz

  ===============================

  TODO:
  - Remove all any types
  - Remove all ! operators

  - Use of Nullish Coalescing & Optional Chaining

*/


//import './external/plotly-basic.min.js';

import {SpectrumData, isotopeList} from './main.js';

interface shape {
  type: string;
  xref: string;
  yref: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  //fillcolor: string,
  line: {
      color: string;
      width: number;
      dash: string;
    };
};

interface anno {
  x: number;
  y: number;
  xref: string;
  yref: string;
  text: string;
  showarrow: boolean;
  arrowhead: number;
  ax: number;
  ay: number;
  hovertext: string;
  font: {
    size: number;
  };
};

interface coeffPoints {
  aFrom: number,
  aTo: number,
  bFrom: number,
  bTo: number,
  cFrom: number,
  cTo: number,
  [index: string]: number
};

export interface coeffObj {
  c1: number,
  c2: number,
  c3: number,
  [index: string]: number
};

export class SpectrumPlot {
  readonly divId: string;
  xAxis = 'linear';
  yAxis = 'linear';
  plotType = 'scatter'; //"scatter", "bar"
  downloadFormat = 'png'; // one of png, svg, jpeg, webp
  sma = false; // Simple Moving Average
  smaLength = 8;
  calibration = {
    enabled: false,
    imported: false,
    points: <coeffPoints>{
      aFrom: 0,
      aTo: 0,
      bFrom: 0,
      bTo: 0,
      cFrom: 0,
      cTo: 0,
    },
    coeff: <coeffObj>{
      c1: 0,
      c2: 0,
      c3: 0,
    },
  };
  cps = false;
  private shapes: shape[] = [];
  private annotations: anno[] = [];
  editableMode = false;
  isoList: isotopeList = {};
  peakConfig = {
    enabled: false,
    mode: 0, // Energy: 0 and Isotope: 1 modes
    thres: 0.025,
    lag: 150,
    width: 2,
    seekWidth: 2,
    lines: <number[]>[],
    lastDataX: <number[]>[],
    lastDataY: <number[]>[],
  };
  private customModeBarButtons = {
    name: 'Download plot as HTML',
    // @ts-ignore // Works just fine without TS complaining
    icon: Plotly.Icons['disk'],
    direction: 'up',
    click: (plotElement: any) => {
      let newLayout = JSON.parse(JSON.stringify(plotElement.layout));
      newLayout.images[0].source = new URL('/assets/logo.svg', window.location.origin).href;

      const newAnno = {
        x: 1,
        y: 0,
        opacity: 0.9,
        xref: 'paper',
        yref: 'paper',
        xanchor: "right",
        yanchor: "bottom",
        text: window.location.origin,
        showarrow: false,
        font: {
          size: 10,
        },
      };
      newLayout.annotations.push(newAnno);

      //let newConfig = JSON.parse(JSON.stringify(plotElement.config));
      //delete newConfig.modeBarButtonsToAdd; // remove this section, otherwise there will be problems!

      const scriptUrl = new URL('/assets/js/external/plotly-basic.min.js', window.location.origin);
      const config = {
        responsive: true,
        displaylogo: false,
        toImageButtonOptions: {
          filename: 'gamma_mca_export',
        }
      };

      const text = `\
      <!DOCTYPE html>
      <!-- Gamma MCA Interactive Export Version 1.1 by NuclearPhoenix. https://spectrum.nuclearphoenix.xyz. -->
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="margin:0;padding:0">
          <div id="plotly-output" style="width:99vw;height:99vh"></div>
          <script src="${scriptUrl}"></script>
          <script type="text/javascript">Plotly.newPlot('plotly-output',${JSON.stringify(plotElement.data)},${JSON.stringify(newLayout)},${JSON.stringify(config)})</script>
        </body>
      </html>\
      `;

      const element = document.createElement('a');
      element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`);
      element.setAttribute('download', 'gamma_mca_export.html');
      element.style.display = 'none';
      element.click();
  }};
  /*
    Constructor
  */
  constructor(divId: string) {
    this.divId = divId;
  }
  /*
    Get An Array with Length == Data.length containing ascending numbers
  */
  private getXAxis(len: number): number[] {
    let xArray: number[] = [];
    for(let i = 0; i < len; i++) {
      xArray.push(i);
    }
    return xArray;
  }
  /*
    Delete calibration points and calibration coefficients
  */
  clearCalibration(): void {
    this.calibration.points = <coeffPoints>{
      aFrom: 0,
      aTo: 0,
      bFrom: 0,
      bTo: 0,
      cFrom: 0,
      cTo: 0,
    };
    this.calibration.coeff = <coeffObj>{
      c1: 0,
      c2: 0,
      c3: 0,
    };
    this.calibration.imported = false;
  }
  /*
    Compute the coefficients used for calibration
  */
  computeCoefficients(): void {
    const aF = this.calibration.points.aFrom;
    const bF = this.calibration.points.bFrom;
    const cF = this.calibration.points.cFrom;
    const aT = this.calibration.points.aTo;
    const bT = this.calibration.points.bTo;
    const cT = this.calibration.points.cTo;

    if (cT >= 0 && cF >= 0) { // Pretty ugly hard scripted, could be dynamically calculated for n-poly using Math.js and matrices. Meh.

      const denom = (aF - bF) * (aF - cF) * (bF - cF);
      this.calibration.coeff.c1 = (cF * (bT - aT) + bF * (aT - cT) + aF * (cT - bT)) / denom;
      this.calibration.coeff.c2 = (Math.pow(cF,2) * (aT - bT) + Math.pow(aF,2) * (bT - cT) + Math.pow(bF,2) * (cT - aT)) / denom;
      this.calibration.coeff.c3 = (bF * (bF - cF) * cF * aT + aF * cF * (cF - aF) * bT + aF * (aF - bF) * bF * cT) / denom;

    } else {

      const k = (aT - bT)/(aF - bF);
      const d = aT - k * aF;

      this.calibration.coeff.c1 = 0;
      this.calibration.coeff.c2 = k;
      this.calibration.coeff.c3 = d;
    }
  }
  /*
    Get the calibrated x-axis using the values in this.calibration
  */
  private getCalAxis(len: number): number[] {
    let calArray: number[] = [];

    const a = this.calibration.coeff.c1;
    const k = this.calibration.coeff.c2;
    const d = this.calibration.coeff.c3;

    for(let i = 0; i < len; i++) {
      calArray.push(parseFloat((a * Math.pow(i,2) + k * i + d).toFixed(2)));
    }

    return calArray;
  }
  /*
    Get The Moving Average
  */
  private computeMovingAverage(target: number[], length = this.smaLength): number[] {
    let newData: number[] = Array(target.length).fill(0);
    const half = Math.round(length/2);

    for(const i in newData) { // Compute the central moving average
      const intIndex = parseInt(i); // Gotcha, I wasted sooo much time on this -_-

      if (intIndex >= half && intIndex <= target.length - half - 1) { // Shortcut
        const remainderIndexFactor = length % 2;

        const addVal = target[intIndex+half-remainderIndexFactor];
        const removeVal = target[intIndex-half];

        newData[intIndex] = newData[intIndex - 1] + (addVal - removeVal) / length;
        continue; // Skip other computation.
      }

      let val = 0;
      let divider = 0;

      for(let j = 0; j < length; j++) { // Slightly asymetrical to the right with even numbers of smaLength
        if (j < half) {
          if ((intIndex - j) >= 0) {
            val += target[intIndex - j];
            divider++;
          }
        } else {
          if ((intIndex - half+1 + j) < newData.length) {
            val += target[intIndex - half+1 + j];
            divider++;
          }
        }
      }
      newData[i] = val / divider;
    }
    return newData;
  }
  /*
    Seek the closest matching isotope by energy from an isotope list
  */
  private seekClosest(value: number, maxDist = 100): {energy: number, name: string} | {energy: undefined, name: undefined} {
    const closeVals = Object.keys(this.isoList).filter(energy => { // Only allow closest values and disregard undefined
      if (energy) return Math.abs(parseFloat(energy) - value) <= maxDist;
      return false;
    });
    const closeValsNum = closeVals.map(energy => parseFloat(energy)) // After this step there are 100% only numbers left

    if (closeValsNum.length > 0) {
      const closest = closeValsNum.reduce((prev, curr) => Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev);

      // closest will always be somewhere in isoList with a key, because we got it from there!
      return {energy: closest, name: this.isoList[closest]!};
    } else {
      return {energy: undefined, name: undefined};
    }
  }
  /*
    Find and mark energy peaks by using two different moving averages
  */
  peakFinder(doFind = true): void {
    if (this.peakConfig.lines.length !== 0) {
      const lines = this.peakConfig.lines
      for (const line of lines) {
        this.toggleLine(line, '', false);
      }
      this.peakConfig.lines = [];
    }

    if (!doFind) {
      return;
    }

    const shortData: number[] = this.peakConfig.lastDataY;
    const longData = this.computeMovingAverage(this.peakConfig.lastDataY, this.peakConfig.lag);

    const maxVal = Math.max(...shortData);
    const xAxisData: number[] = this.peakConfig.lastDataX;
    let peakLines: number[] = [];

    const shortLen = shortData.length;

    for (let i = 0; i < shortLen; i++) {
      if (shortData[i] - longData[i] > this.peakConfig.thres * maxVal) peakLines.push(xAxisData[i]);
    }

    let values: number[] = [];
    peakLines.push(0);

    const peakLen = peakLines.length

    for (let i = 0; i < peakLen; i++) {
      values.push(peakLines[i]);

      if (Math.abs(peakLines[i + 1] - peakLines[i]) > this.peakConfig.width) {
        let result = 0;
        let size: number;

        if (values.length === 1) {
          result = peakLines[i];
          size = this.peakConfig.seekWidth;
        } else {
          for (const val of values) {
            result += val;
          }
          result /= values.length;
          size = this.peakConfig.seekWidth * (Math.max(...values) - Math.min(...values));
        }

        if (this.peakConfig.mode === 0) {
          this.toggleLine(result, result.toFixed(2));
          this.peakConfig.lines.push(result);
        } else { // Isotope Mode
          const { energy, name } = this.seekClosest(result, size);
          if (energy && name) {
            this.toggleLine(energy, name);
            this.peakConfig.lines.push(energy);
          }
        }

        values = [];
      }
    }
  }
  /*
    Convenient Wrapper, could do more in the future
  */
  resetPlot(spectrumData: SpectrumData): void {
    this.plotData(spectrumData, false); // Not Updating
  }
  /*
    Convenient Wrapper, could do more in the future
  */
  updatePlot(spectrumData: SpectrumData): void {
    this.plotData(spectrumData); // Updating
  }
  /*
    Clear all shapes and annotations
  */
  clearShapeAnno(): void {
    this.shapes = [];
    this.annotations = [];
  }
  /*
    Add a line
  */
  toggleLine(energy: number, name: string, enabled = true): void {
    name = name.replaceAll('-',''); // Remove - to save space
    if (enabled) {
      const newLine: shape = {
        type: 'line',
        xref: 'x',
        yref: 'paper',
        x0: energy,
        y0: 0,
        x1: energy,
        y1: 1,
        //fillcolor: 'black',
        line: {
            color: 'blue',
            width: .5,
            dash: 'solid'
          },
      };
      const newAnno: anno = {
        x: parseFloat(energy.toFixed(2)),
        y: 1,
        xref: 'x',
        yref: 'paper',
        text: name,
        showarrow: true,
        arrowhead: 7,
        ax: 0,
        ay: -20,
        hovertext: energy.toFixed(2),
        font: {
          size: 11,
        },
      };

      // Check for duplicates!
      for (const shape of this.shapes) {
        if (JSON.stringify(shape) === JSON.stringify(newLine)) return;
      }
      for (const anno of this.annotations) {
        if (JSON.stringify(anno) === JSON.stringify(newAnno)) return;
      }

      // Not a duplicate
      this.shapes.push(newLine);
      this.annotations.push(newAnno);
    } else {
      for (const i in this.shapes) {
        if (this.shapes[i].x0 === energy) this.shapes.splice(parseInt(i),1);
      }
      for (const i in this.annotations) {
        if (this.annotations[i].x === parseFloat(energy.toFixed(2))) this.annotations.splice(parseInt(i),1);
      }
    }
  }
  /*
    Clear annotations and shapes
  */
  clearAnnos(): void {
    this.shapes = [];
    this.annotations = [];
  }
  /*
    Plot All The Data
  */
  plotData(dataObj: SpectrumData, update = true): void {
    let trace = {
      name: 'Clean Spectrum',
      stackgroup: 'data', // Stack line charts on top of each other

      x: this.getXAxis(dataObj.data.length),
      y: dataObj.data,
      type: this.plotType,
      mode: 'lines', // Remove lines, "lines", "none"
      fill: 'tozeroy',
      //opacity: 0.8,
      line: {
        color: 'orangered',
        width: .5,
      },
      marker: {
        color: 'orangered',
      },
      width: 1,
    };

    let maxXValue = Math.max(...trace.x);

    let data = [trace];

    /*
      Total number of pulses divided by seconds running. Counts Per Second
    */
    if (this.cps) data[0].y = dataObj.dataCps;
    /*
      Compute Background and Corrected Spectrum
    */
    if (dataObj.background.length > 0) { //== dataObj.data.length)
      let bgTrace = {
        name: 'Background',
        stackgroup: 'data', // Stack line charts on top of each other

        x: this.getXAxis(dataObj.background.length),
        y: dataObj.background,
        type: this.plotType,
        mode: 'ono', // Remove lines, "lines", "none"
        fill: 'tozeroy',
        //opacity: 1,
        line: {
          color: 'slategrey',
          width: .5,
        },
        marker: {
          color: 'slategrey',
        },
        width: 1,
      };

      if (bgTrace.x.length > maxXValue) maxXValue = Math.max(...bgTrace.x);

      if (this.cps) bgTrace.y = dataObj.backgroundCps;

      const newData: number[] = []; // Compute the corrected data, i.e. data - background
      const dataLen = data[0].y.length;
      for (let i = 0; i < dataLen; i++) {
        newData.push(data[0].y[i] - bgTrace.y[i]);
      }

      trace.y = newData;
      trace.fill = 'tonexty'; //'tonextx'

      data = data.concat(bgTrace);
      data.reverse();
    }
    /*
      Set Simple Moving Average
    */
    if (this.sma) { // SIMPLE MOVING AVERAGE. MAYBE PLOT IT AS DIFFERENT LINE?
      for (const element of data) {
        element.y = this.computeMovingAverage(element.y);
      }
    }
    /*
      All The Layout Stuff
    */
    let layout = {
      uirevision: true,
      autosize: true, // Needed for resizing on update
      title: 'Energy Spectrum',
      hovermode: 'x',
      legend: {
        orientation: 'h',
        y: -0.35,
      },
      barmode: 'stack',

      xaxis: {
        title: 'ADC Channel [1]',
        mirror: true,
        linewidth: 2,
        autorange: false,
        fixedrange: false,
        range: [0,maxXValue],
        type: this.xAxis, // 'linear' or 'log'
        rangeslider: {
          borderwidth: 1,
          autorange: false,
          range: [0,maxXValue],
        },
        showspikes: true, //Show spike line for X-axis
        spikethickness: 1,
        spikedash: 'solid',
        spikecolor: 'black',
        spikemode: 'across',
        //nticks: 20,
        //tickformat: '.02f',
        ticksuffix: '',
        exponentformat: 'SI',
      },
      yaxis: {
        title: 'Counts [1]',
        mirror: true,
        linewidth: 2,
        autorange: true,
        fixedrange: false,
        type: this.yAxis, // 'linear' or 'log'
        showspikes: true, //Show spike line for Y-axis
        spikethickness: 1,
        spikedash: 'solid',
        spikecolor: 'black',
        spikemode: 'across',
        showticksuffix: 'last',
        ticksuffix: ' cts',
        //tickformat: '.02f',
        showexponent: 'last',
        exponentformat: 'SI',
      },
      plot_bgcolor: 'white',
      paper_bgcolor: '#f8f9fa', // Bootstrap bg-light
      margin: {
        l: 80,
        r: 40,
        b: 60,
        t: 60,
        //pad: 4,
      },
      images: [{
        x: 0.99,
        y: 0.99,
        opacity: 0.4,
        sizex: 0.15,
        sizey: 0.15,
        source: '/assets/logo.svg',
        xanchor: 'right',
        xref: 'paper',
        yanchor: 'top',
        yref: 'paper',
      }],
      shapes: <shape[]>[],
      annotations: <anno[]>[],
      //shapes: this.shapes,
      //annotations: JSON.parse(JSON.stringify(this.annotations)), // Copy array but do not reference
    };
    /*
      Set calibrated x-axis
    */
    if (this.calibration.enabled) {
      for (const element of data) {
        element.x = this.getCalAxis(element.x.length);
      }
      layout.xaxis.title = 'Energy [keV]';
      layout.xaxis.ticksuffix = ' keV';

      const newMax = Math.max(...data[0].x);
      layout.xaxis.range = [0,newMax];
      layout.xaxis.rangeslider.range = [0,newMax];
    }
    /*
      CPS enabled
    */
    if (this.cps) {
      layout.yaxis.title = 'Counts Per Second [Hz]';
      layout.yaxis.ticksuffix = ' cps';
    }

    let config = {
      responsive: true,
      scrollZoom: false,
      displayModeBar: true,
      displaylogo: false,
      toImageButtonOptions: {
        format: this.downloadFormat,
        filename: 'gamma_mca_export',
      },
      editable: this.editableMode,
      modeBarButtonsToAdd: <any[]>[],
    };

    /*
      Peak Detection Stuff
    */
    if (this.peakConfig.enabled) {
      if (data.length === 1) {
        this.peakConfig.lastDataX = data[0].x;
        this.peakConfig.lastDataY = data[0].y;
      } else {
        this.peakConfig.lastDataX = data[1].x;
        this.peakConfig.lastDataY = data[1].y;
      }
      this.peakFinder();
    }

    layout.shapes = this.shapes;
    layout.annotations = JSON.parse(JSON.stringify(this.annotations)); //layout.annotations.concat(JSON.parse(JSON.stringify(this.annotations))); // Copy array but do not reference

    if (this.calibration.enabled) {
      for (const anno of layout.annotations) {
        anno.hovertext += layout.xaxis.ticksuffix;
      }
    }

    /*
      HTML EXPORT FUNCTIONALITY
    */
    config.modeBarButtonsToAdd = [this.customModeBarButtons];

    if (update) {
      //layout.uirevision = true;
      // @ts-ignore // Works just fine without TS complaining
      Plotly.react(this.divId, data, layout, config);
    } else {
      // @ts-ignore // Works just fine without TS complaining
      Plotly.newPlot(this.divId, data, layout, config);
    }
  }
}
