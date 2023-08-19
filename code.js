readUrlParams();

recalculate();

document.querySelectorAll('input').forEach(input => {
    input.onkeyup = recalculate;
});

function recalculate() {
    try
    {
        setUrlParams();

        const weaponName = document.getElementById('weapon_title').value;
        const targetName = document.getElementById('target_title').value;

        document.title = `${weaponName} vs ${targetName}`;

        const attacks = getD3D6FieldValue('attacks');
        const skill = getIntInputValue('skill');
        const hitReroll = getSelectValue('hit_reroll');
        const strength = getIntInputValue('strength');
        const woundReroll = getSelectValue('wound_reroll');
        const armourPiercing = getIntInputValue('ap');
        const dam = getD3D6FieldValue('damage');
        const toughness = getIntInputValue('toughness');
        const save = getIntInputValue('save');
        const invulnSave = getIntInputValue('invuln_save');
        const anti = getIntInputValue('anti');

        const hitProbability = getProbability(skill, hitReroll);

        let toWound = getToWoundValue(strength, toughness);
        toWound = toWound > anti ? anti : toWound;
        const woundProbability = getProbability(toWound, woundReroll);

        const modifiedSave = save + armourPiercing;
        const effectiveSave = modifiedSave < invulnSave ? modifiedSave : invulnSave;
        const saveProbability = 1 - getProbability(effectiveSave);

        const result = dam * attacks * hitProbability * woundProbability * saveProbability;
        document.getElementById('result').innerHTML = round(result, 4);
    } 
    catch (err) {
        console.error(err);
    }
}

/**
 * @param input {HTMLInputElement} 
 * @param params {URLSearchParams}
 * */
function setIntInput(input, params) {
    const paramName = getParamNameAttribute(input);
    const paramValue = paramName && params.get(paramName) || getDefaultValue(input);
    input.value = parseInt(paramValue);
}

/**
 * @param input {HTMLInputElement} 
 * @param params {URLSearchParams}
 * */
function setStringInput(input, params) {
    const paramName = getParamNameAttribute(input);
    const paramValue = paramName && params.get(paramName) || getDefaultValue(input);
    input.value = paramValue;
}

/**
 * @param select {HTMLSelectElement} 
 * @param params {URLSearchParams}
 * */
function setSelect(select, params) {
    const paramName = getParamNameAttribute(select);
    const paramValue = paramName && params.get(paramName) || getDefaultValue(select);
    select.value = paramValue;
}

/**
 * @param element {HTMLElement} 
 * */
function getParamNameAttribute(element) {
    return element.getAttribute('url-param');
}

/**
 * @param element {HTMLElement} 
 * */
    function getDefaultValue(element) {
    return element.getAttribute('default-value');
}

function getIntInputValue(id) {
    const input = document.getElementById(id);
    return parseInt(input && input.value);
}

function getSelectValue(id) {
    const input = document.getElementById(id);
    return input && input.value;
}

function round(n, d = digits) {
    const factor = Math.pow(10, d);
    return Math.round(n * factor) / factor;
}

function getProbability(toHit, rerollType) {
    const baseProbability = (7 - toHit) / 6;
    if (baseProbability <= 0) {
        return 0;
    }

    switch (rerollType) {
        case '1': 
            // base + chance of rolling 1 * base
            return baseProbability + 1 / 6 * baseProbability;
        case 'all': 
            // base + chance of failure * base
            return baseProbability + (1 - baseProbability) * baseProbability;
    }

    return baseProbability;
}

function getToWoundValue(strength, toughness) {
    const ratio = toughness / strength;

    if (ratio >= 2) {
        return 6;
    } else if (ratio > 1) {
        return 5;
    } else if (ratio == 1) {
        return 4;
    } else if (ratio > 0.5) {
        return 3;
    }

    return 2;
}

function readUrlParams() {
    const params = new URLSearchParams(window.location.search);
    document.querySelectorAll('input[type=number]').forEach(input => setIntInput(input, params));
    document.querySelectorAll('input[type=text]').forEach(input => setStringInput(input, params));
    document.querySelectorAll('select').forEach(input => setSelect(input, params));
}

function setUrlParams() {
    const params = new URLSearchParams(window.location.search);
    document.querySelectorAll('input, select').forEach(input => {
        const paramName = getParamNameAttribute(input)
        if (paramName) {
            if (input.value !== getDefaultValue(input)){
                params.set(paramName, input.value);
            } else {
                params.delete(paramName);
            }
        }
    });

    const path = location.href.split('?')[0] + '?' + params.toString();
    window.history.pushState(path, document.title, path);
}

function getD3D6FieldValue(fieldName) {
    const constPart = getIntInputValue(fieldName);
    const d6Part = getIntInputValue(fieldName + '_d6');
    const d3Part = getIntInputValue(fieldName + '_d3');
    return constPart + d6Part * 3.5 + d3Part * 2;
}