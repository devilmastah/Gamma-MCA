import './external/ZSchema-browser-min.js';
export class RawData {
    valueIndex;
    delimiter;
    adcChannels = 4096;
    fileType;
    tempValIndex;
    schemaURLTable = {
        NPESv1: '/assets/npes-1.schema.json',
        NPESv2: '/assets/npes-2.schema.json'
    };
    schemaJSON = {
        NPESv1: undefined,
        NPESv2: undefined
    };
    constructor(valueIndex, delimiter = ',') {
        this.valueIndex = valueIndex;
        this.delimiter = delimiter;
        this.adcChannels;
        this.fileType = valueIndex;
        this.tempValIndex = valueIndex;
    }
    checkLines(value) {
        const values = value.split(this.delimiter);
        if (isNaN(parseFloat(values[0].trim())))
            return false;
        if (values.length === 1)
            this.tempValIndex = 0;
        return values.length > this.tempValIndex;
    }
    parseLines(value) {
        const values = value.split(this.delimiter);
        return parseFloat(values[this.tempValIndex].trim());
    }
    histConverter(dataArr) {
        const xArray = Array(this.adcChannels).fill(0);
        for (const element of dataArr) {
            xArray[element] += 1;
        }
        return xArray;
    }
    parseCalibration(valueArray) {
        if (!this.tempValIndex)
            return undefined;
        if (valueArray.length < 2)
            return undefined;
        const values1 = valueArray[0].split(this.delimiter);
        const values2 = valueArray[1].split(this.delimiter);
        const float1 = parseFloat(values1[0].trim());
        const float2 = parseFloat(values2[0].trim());
        const c2 = float2 - float1;
        const c3 = float1;
        return [0, c2, c3];
    }
    csvToArray(data) {
        this.tempValIndex = this.valueIndex;
        const returnData = {
            histogramData: [],
            calibrationCoefficients: undefined
        };
        if (this.fileType === 1) {
            const dataLines = data.split('\n').filter(this.checkLines, this);
            returnData.calibrationCoefficients = this.parseCalibration(dataLines);
            returnData.histogramData = dataLines.map(this.parseLines, this);
        }
        else {
            const dataEvents = data.split(this.delimiter).filter(this.checkLines, this);
            returnData.histogramData = this.histConverter(dataEvents.map(this.parseLines, this));
        }
        return returnData;
    }
    xmlToArray(data) {
        const coeff = {
            c1: 0,
            c2: 0,
            c3: 0
        };
        const meta = {
            name: '',
            location: '',
            time: '',
            notes: '',
            deviceName: '',
            startTime: '',
            endTime: '',
            dataMt: 0,
            backgroundMt: 0
        };
        try {
            const xmlDoc = new DOMParser().parseFromString(data, 'text/xml');
            const especTop = xmlDoc.getElementsByTagName('EnergySpectrum');
            let espectrum = [];
            let bgspectrum = [];
            if (especTop[0]) {
                const espec = especTop[0].getElementsByTagName('DataPoint');
                espectrum = Array.from(espec).map(item => parseFloat(item.textContent ?? '-1'));
                meta.dataMt = parseFloat(especTop[0].getElementsByTagName('MeasurementTime')[0]?.textContent?.trim() ?? '1');
            }
            const bgspecTop = xmlDoc.getElementsByTagName('BackgroundEnergySpectrum');
            if (bgspecTop[0]) {
                const bgspec = bgspecTop[0].getElementsByTagName('DataPoint');
                bgspectrum = Array.from(bgspec).map(item => parseFloat(item.textContent ?? '-1'));
                meta.backgroundMt = parseFloat(bgspecTop[0].getElementsByTagName('MeasurementTime')[0]?.textContent?.trim() ?? '1');
            }
            const calCoeffsTop = xmlDoc.getElementsByTagName('EnergySpectrum')[0];
            if (calCoeffsTop) {
                const calCoeffs = calCoeffsTop.getElementsByTagName('Coefficient');
                const coeffNumArray = Array.from(calCoeffs).map(item => parseFloat((item.textContent ?? '0')));
                for (const i in coeffNumArray) {
                    coeff['c' + (parseInt(i) + 1).toString()] = coeffNumArray[2 - parseInt(i)];
                }
            }
            const rdl = xmlDoc.getElementsByTagName('SampleInfo')[0];
            meta.name = rdl?.getElementsByTagName('Name')[0]?.textContent?.trim() ?? '';
            meta.location = rdl?.getElementsByTagName('Location')[0]?.textContent?.trim() ?? '';
            meta.time = rdl?.getElementsByTagName('Time')[0]?.textContent?.trim() ?? '';
            meta.notes = rdl?.getElementsByTagName('Note')[0]?.textContent?.trim() ?? '';
            let val = parseFloat(rdl?.getElementsByTagName('Weight')[0]?.textContent?.trim() ?? '0');
            if (val > 0)
                meta.weight = val * 1000;
            val = parseFloat(rdl?.getElementsByTagName('Volume')[0]?.textContent?.trim() ?? '0');
            if (val > 0)
                meta.volume = val * 1000;
            meta.deviceName = xmlDoc.getElementsByTagName('DeviceConfigReference')[0]?.getElementsByTagName('Name')[0]?.textContent?.trim() ?? '';
            meta.startTime = xmlDoc.getElementsByTagName('StartTime')[0]?.textContent?.trim() ?? '';
            meta.endTime = xmlDoc.getElementsByTagName('EndTime')[0]?.textContent?.trim() ?? '';
            return { espectrum, bgspectrum, coeff, meta };
        }
        catch (e) {
            console.error(e);
            return { espectrum: [], bgspectrum: [], coeff, meta };
        }
    }
    async jsonToObject(data) {
        let json;
        try {
            json = JSON.parse(data);
        }
        catch (e) {
            console.error(e);
            return [{ code: 'JSON_PARSE_ERROR', description: `A problem with the JSON formatting occured when trying to parse the contents of the file: ${e}` }];
        }
        let version;
        try {
            if (json.schemaVersion === 'NPESv1' || json.schemaVersion === 'NPESv2') {
                version = json.schemaVersion;
            }
            else {
                throw `schemaVersion is neither NPESv1 nor NPESv2, but ${json.schemaVersion}!`;
            }
        }
        catch (e) {
            console.error(e);
            return [{ code: 'NPES_VERSION_ERROR', description: `An error occured when trying to parse the schema version: ${e}` }];
        }
        try {
            if (!this.schemaJSON[version]) {
                const response = await fetch(this.schemaURLTable[version]);
                if (response.ok) {
                    const schema = await response.json();
                    delete schema['$schema'];
                    this.schemaJSON[version] = schema;
                }
                else {
                    throw 'Could not load the schema file!';
                }
            }
            const validator = new window.ZSchema();
            validator.validate(json, this.schemaJSON[version]);
            const errors = validator.getLastErrors();
            if (errors) {
                const errorMessages = [];
                for (const error of errors) {
                    errorMessages.push({
                        'code': error.code,
                        'description': error.message
                    });
                }
                console.error(errorMessages);
                return errorMessages;
            }
            if (version === 'NPESv1') {
                return [json];
            }
            else {
                return json.data;
            }
        }
        catch (e) {
            console.error(e);
            return [{ code: 'UNDEFINED_ERROR', description: `Some undefined error occured: ${e}` }];
        }
    }
}
//# sourceMappingURL=raw-data.js.map