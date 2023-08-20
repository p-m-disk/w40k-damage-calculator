readUrlParams();

recalculate();

document.querySelectorAll('input, select').forEach(input => {
    input.onkeyup = recalculate;
    input.onchange = () => {
        checkRelatedInput(input);
        
        recalculate();
    };
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
        const strength = getIntInputValue('strength');
        const armourPiercing = getIntInputValue('ap');
        const dam = getD3D6FieldValue('damage');
        
        const toughness = getIntInputValue('toughness');
        const save = getIntInputValue('save');
        const invulnSave = getOptionalIntInputValue('invuln_save', 7);
        const feelNoPain = getOptionalIntInputValue('feel_no_pain', 7);

        const anti = getOptionalIntInputValue('anti', 7);
        const hasDevastatingWounds = getBoolValue('dev_wounds');
        const hasLethalHits = getBoolValue('lethal_hits');
        const sustainedHits = getOptionalIntInputValue('sustained_hits');

        const hitModifier = getIntInputValue('hit_modifier');
        const hitReroll = getSelectValue('hit_reroll');
        const hitFishCrit = getBoolValue('hit_fish6');

        const woundModifier = getIntInputValue('wound_modifier');
        const woundReroll = getSelectValue('wound_reroll');
        const woundFishCrit = getBoolValue('wnd_fish6');

        let hitProbability = getBaseProbability(skill, hitModifier);
        hitProbability = applyReroll(hitProbability, hitReroll, hitFishCrit);

        const hits = attacks * hitProbability.pass;
        const criticalHits = attacks * hitProbability.critical;
        const additionalHits = sustainedHits ? criticalHits * sustainedHits : 0;

        const lethalHits = hasLethalHits ? criticalHits : 0;
        let woundsToRoll = hits + additionalHits + criticalHits - lethalHits; // do not roll for lethal hits
        let wounds = lethalHits;
        
        const toWound = getToWoundValue(strength, toughness);
        let woundProbability = getBaseProbability(toWound, woundModifier, anti);
        woundProbability = applyReroll(woundProbability, woundReroll, woundFishCrit);

        wounds += woundProbability.pass * woundsToRoll;
        const criticalWounds = woundProbability.critical * woundsToRoll;
        let inflictedWounds = 0;

        if (hasDevastatingWounds) {
            inflictedWounds += criticalWounds;
        } else {
            wounds += criticalWounds;
        }

        const modifiedSave = save + armourPiercing;
        const effectiveSave = modifiedSave < invulnSave ? modifiedSave : invulnSave;
        const passSaveProbability = 1 - getSimpleD6(effectiveSave);

        inflictedWounds += wounds * passSaveProbability;

        const damageInflicted = dam * inflictedWounds;

        const feelNoPainProbability = 1 - getSimpleD6(feelNoPain);

        const result = damageInflicted * feelNoPainProbability;
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
 * 
 * @param {HTMLInputElement} input 
 * @param {URLSearchParams} params 
 */
function setCheckbox(input, params) {
    const paramName = getParamNameAttribute(input);
    const paramValue = paramName && params.get(paramName) || getDefaultValue(input);
    input.checked = !!paramValue;

    checkRelatedInput(input);
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

function getOptionalIntInputValue(id, defaultValue) {
    const hasElement = document.getElementById('has_' + id);
    if (hasElement && !hasElement.checked) {
        return defaultValue;
    }
    
    return getIntInputValue(id);
}

function getSelectValue(id) {
    const input = document.getElementById(id);
    return input && input.value;
}

function getBoolValue(id) {
    const input = document.getElementById(id);
    return input && input.checked;
}

function round(n, d = digits) {
    const factor = Math.pow(10, d);
    return Math.round(n * factor) / factor;
}

/**
 * 
 * @param {number} toPass 
 * @param {number} rerollType 
 * @param {number} modifier 
 * @returns {Probability}
 */
function getBaseProbability(toPass, modifier = 0, critical = 6) {
    const modifiedToPass = toPass - modifier;
    
    const critProbability = 1 / 6 + (6 - critical) / 6; // natural crit + additional crit chance from i.g. ANTI +N
    const passProbability = getSimpleD6(modifiedToPass);
    const failProbability = 1 - passProbability;

    return {
        one: 1 / 6, // natural fail
        fail: Math.max(0, failProbability - 1 / 6), // general failure, except the natural fail
        pass: Math.max(0, passProbability - critProbability),
        critical: critProbability
    };
}

/**
 * 
 * @param {Probability} baseProbability 
 * @param {'1' | 'all' | null} rerollType 
 * @returns 
 */
function applyReroll(baseProbability, rerollType, fishForCrits) {
    switch (rerollType) {
        case '1': 
            return {
                one: baseProbability.one * baseProbability.one,
                fail: baseProbability.fail + baseProbability.one * baseProbability.fail,
                pass: baseProbability.pass + baseProbability.one * baseProbability.pass,
                critical: baseProbability.critical + baseProbability.one * baseProbability.critical,
            };
        case 'all': 
            // would reroll a non-crit pass when fishing for crits
            const chanceOfReroll = baseProbability.one + baseProbability.fail + (fishForCrits ? baseProbability.pass : 0);
            
            const passProbability = fishForCrits 
                ? (baseProbability.pass * chanceOfReroll)
                : (baseProbability.pass + baseProbability.pass * chanceOfReroll);

            return {
                one: baseProbability.one * chanceOfReroll,
                fail: baseProbability.fail * chanceOfReroll,
                pass: passProbability,
                critical: baseProbability.critical + chanceOfReroll * baseProbability.critical,
            };
    }

    return baseProbability;
}

function getSimpleD6(toPass) {
    return (7 - toPass) / 6;
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
    document.querySelectorAll('input[type=checkbox]').forEach(input => setCheckbox(input, params));
    document.querySelectorAll('select').forEach(input => setSelect(input, params));
}

function setUrlParams() {
    const params = new URLSearchParams(window.location.search);
    document.querySelectorAll('input, select').forEach(input => {
        const paramName = getParamNameAttribute(input)
        if (paramName) {
            let value = input.value;

            if (input.type == 'checkbox') {
                value = input.checked ? 'y' : null;
            }
            
            if (value !== getDefaultValue(input)){
                params.set(paramName, value);
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

/**
 * Check if the related element should be enabled or disabled
 * @param {HTMLInputElement} input 
 */
function checkRelatedInput(input) {
    if (input.id.startsWith('has_')){
        const relatedElement = document.getElementById(input.id.substring(4));
        if (relatedElement) {
            relatedElement.disabled = !input.checked;
        }
    }
}

/**
 * @typedef Probability
 * @property {number} one
 * @property {number} fail
 * @property {number} pass 
 * @property {number} critical
 */