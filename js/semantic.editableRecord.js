(function($) {

    //add batch operation
    $.fn.editableRecord = function( options ) {
        var $this = $.extend(this, defaultSetting, options);

        initialize($this);

        return this;
    };

    var defaultSetting = {
        //attributes
        idName: null,
        multiple: true,
        addable: true,

        //buttons
        saveButton: '<div name="save" class="ui primary button">Save</div>',
        cancellButton: '<div name="cancel" class="ui button">Cancel</div>',
        newButton: '<div class="ui positive button">New</div>',
        deleteButton: '<div class="ui icon button"><i class="trash icon"></i></div>',
        detailButton: '<div class="ui icon button"><i class="unordered list icon"></i></div>',
        orButton: '<div class="or"></div>',
        buttonGroup: '<div class="ui buttons"></div>',
        saveButtonLocation: '',

        //urls
        createUrl: null,
        updateUrl: null,
        saveUlr: null,
        deleteUrl: null,

        //events
        preCreate: jQuery.noop,
        preUpdate: jQuery.noop,
        preSave: jQuery.noop,
        preDelete: jQuery.noop,
        postCreate: jQuery.noop,
        postUpdate: jQuery.noop,
        postSave: jQuery.noop,
        postDelete: jQuery.noop,
        detailButtonClicked: jQuery.noop,
        errorHandler: jQuery.noop
    };

    function initialize(editableRecord){
        if(editableRecord.addable){
            appendNewButton(editableRecord);
        }
        appendButtons(editableRecord);
        appendTableHeadForDeleteButton(editableRecord);
        initButtons(editableRecord);
        makeTableEditable(editableRecord);
        getValidation(editableRecord);
    }

    function getKeys(editableRecord){
        var keys = [];
        editableRecord.find('thead th').each(function (i, th) {
            var key = $(th).attr('name');
            if(key !== 'action') keys.push(key);
        });
        return keys;
    }

    function makeTableEditable(editableRecord){
        editableRecord.find('tbody tr').each(function (i, tr) {
            makeFieldsEditable(editableRecord, tr);
        });
    }

    function getPostData(editableRecord, keys, row){
        var fields = row.find('td');
        var tmp = {};
        if(row.attr('id') !== undefined){
            tmp[editableRecord.idName] = row.attr('id');
        }
        for(var i = 0; i < keys.length; i++){
            if($(fields[i]).data('type') == 'select'){
                tmp[keys[i]] = $(fields[i]).find('select').val();
            }else {
                tmp[keys[i]] = $(fields[i]).find('input').val();
            }
        }
        return tmp;
    }

    function appendButtons(editableRecord){

        editableRecord.buttonGroup = $(editableRecord.buttonGroup).append(editableRecord.cancellButton + editableRecord.orButton + editableRecord.saveButton);
        editableRecord.buttonGroup.css('float', 'right').insertAfter(editableRecord);
        editableRecord.buttonGroup.find('div[name=save]').on('click.editableRecord', function(){
            saveButtonClicked(editableRecord);
        });
        editableRecord.buttonGroup.find('div[name=cancel]').on('click.editableRecord', function(){
            cancelButtonClicked(editableRecord);
        });
    }

    function appendNewButton(editableRecord){
        editableRecord.newButton = $(editableRecord.newButton);
        editableRecord.newButton.css('float', 'left').insertAfter(editableRecord).on('click.editableRecord', function(){
            newButtonClicked(editableRecord);
        });
    }

    function appendTableHeadForDeleteButton(editableRecord){
        editableRecord.find('thead tr').append('<th name="action">Action</th>')
    }

    function hideButtons(editableRecord){
        editableRecord.buttonGroup.hide();
    }

    function hideNewButton(editableRecord){
        editableRecord.newButton.hide();
    }

    function showButtons(editableRecord){
        editableRecord.buttonGroup.show();
    }

    function showNewButton(editableRecord){
        editableRecord.newButton.show();
    }

    function initButtons(editableRecord){
        hideButtons(editableRecord);
        hideNewButton(editableRecord);

        if(editableRecord.multiple) {
            showNewButton(editableRecord);
        }
    }

    function makeFieldsEditable(editableRecord, row){
        var $row = $(row);

        if(!$row.find('td').last().hasClass('action')){
            $row.append('<td class="action"></td>');
        }

        $row.find('td').each(function(i, td){
            var $field = $(td);
            if(!$field.hasClass('action')) {
                var typePlugin = getTypePlugin(td);
                var input = typePlugin.makeEditable(td);
                input.on('change.editableRecord keyup.editableRecord click.editableRecord', function(){
                    if(typePlugin.isChanged($field)){
                        showButtons(editableRecord);
                    }
                });
                $field.empty();
                $field.append(input);
            }else{
                $(editableRecord.detailButton).appendTo($field).on('click.editableRecord', function () {
                    if($(this).closest('tr').attr('id') === undefined) return;
                    editableRecord.detailButtonClicked($(this).closest('tr'));
                });
                $(editableRecord.deleteButton).appendTo($field).on('click.editableRecord', function () {
                    deleteButtonClicked(editableRecord, $row);
                });
            }
        });
    }

    function newButtonClicked(editableRecord){
        var rowTemplate = getRowTemplate(editableRecord);
        $(rowTemplate).appendTo(editableRecord);
    }

    function saveButtonClicked(editableRecord){
        var keys = getKeys(editableRecord);
        var postDatas = [];
        editableRecord.find('tbody tr').each(function (i, tr) {
            var $row = $(tr);
            var postData = {};

            if(isChanged($row)){
                if(doValidate(editableRecord, $row)){
                    postData = getPostData(editableRecord, keys, $row);
                    postDatas.push({data:postData, row: $row});
                }else {
                    $row.addClass('negative');
                    $row.find('div.ui.input').addClass('error');
                }
            }
        });

        saveAll(editableRecord, postDatas);
    }

    function cancelButtonClicked(editableRecord){
        editableRecord.find('tbody tr').each(function (i, tr) {
            var $row = $(tr);

            if($row.attr('id') === 'new'){
                $row.remove();
            }else{
                $row.find('td').each(function(i, td){
                    var $field = $(td);
                    $field.find('input').val($field.data('value'));
                });
            }
        });
        hideButtons(editableRecord);
    }

    function deleteButtonClicked(editableRecord, row){
        if($(row).attr('id') == undefined){
            $(row).remove();
        }else{
            var postData = {};
            postData[editableRecord.idName] = row.attr('id');
            editableRecord.preDelete(row);
            $.ajax({
                url: editableRecord.deleteUrl,
                type: 'POST',
                data: postData,
                cache: false,
                dataType: 'json',
                success: function(result){
                    row.remove();
                    editableRecord.postDelete(result);
                }
            });
        }
    }

    function saving(editableRecord){
        $(editableRecord.saveButton).addClass('loading');
        $(editableRecord.cancellButton).addClass('loading');
        $(editableRecord.newButton).addClass('loading');
        editableRecord.find('tbody tr').each(function (i, tr) {
            $(tr).removeClass('positive');
        });
    }

    function saveAll(editableRecord, postDatas){
        if($.isEmptyObject(postDatas)) return;

        saving(editableRecord);

        var requests = [];
        $.each(postDatas, function (i, postData) {
            var isNew = isNewRecord(editableRecord, postData.data);

            if(isNew){
                editableRecord.preCreate(postData.data);
            }else{
                editableRecord.preUpdate(postData.data);
            }
            editableRecord.preSave(postData);

            var request = $.ajax({
                url: isNew ? (editableRecord.createUrl ? editableRecord.createUrl : editableRecord.saveUrl) : (editableRecord.updateUrl ? editableRecord.updateUrl : editableRecord.saveUrl),
                type : 'POST',
                data: postData.data,
                cache : false,
                dataType : 'json',
                success: function(result){
                    postData.row.removeClass('negative').addClass('positive');
                    postData.row.find('div.ui.input').removeClass('error');
                    postData.row.attr('id', result[editableRecord.idName]);
                    postData.row.find('td').each(function(idx, td){
                        var typePlugin = getTypePlugin(td);
                        typePlugin.fieldSaved(td);
                    });
                    if(isNew){
                        editableRecord.postCreate(result);
                    }else{
                        editableRecord.postUpdate(result);
                    }
                    editableRecord.postSave(result);
                },
                error: function(result){
                    postData.row.removeClass('positive').addClass('negative');
                    editableRecord.errorHandler(result);
                    saveComplete(editableRecord);
                }
            });
            requests.push(request);
        });

        $.when.apply($, requests).then(function(){
            //todo: add error handler
            saveComplete(editableRecord);
        });
    }

    function saveComplete(editableRecord){
        $(editableRecord.saveButton).removeClass('loading');
        $(editableRecord.cancellButton).removeClass('loading');
        $(editableRecord.newButton).removeClass('loading');
        hideButtons(editableRecord);
    }

    function isNewRecord(editableRecord, postData){
        return postData[editableRecord.idName] === undefined;
    }

    function isChanged(row){
        var result = false;
        row.find('td').each(function(i, td){
            var $field = $(td);
            if(!$field.hasClass('action')){
                var typePlugin = getTypePlugin(td);
                if(typePlugin.isChanged($field)){
                    result = true;
                }
            }
        });
        return result;
    }

    function getRowTemplate(editableRecord){
        var rowTemplate = editableRecord.find('thead tr').clone();
        rowTemplate.find('th').each(function (i, th) {
            var $td = $('<td></td>');
            $.each($(th).data(), function(key, value){
                $td.attr('data-'+key, value);
            });

            if($(th).attr('name') == 'action'){
                $(th).remove();
            }else{
                $(th).replaceWith($td);
            }
        });
        makeFieldsEditable(editableRecord, rowTemplate);
        return rowTemplate;
    }

    function getTypePlugin(td){
        var type = $(td).data('type');
        if(type === undefined){
            type = 'text';
        }

        var typePlugin = $.fn.editableRecord.typePlugins[type];
        if(typePlugin === undefined){
            console.error('No avaliable plugin found for "' + type + '"');
        }

        return typePlugin;
    }

    function getValidation(editableRecord){
        editableRecord.validation = {};
        editableRecord.find('thead th').each(function(i, th){
            var $th = $(th), keyName = $th.attr('name');
            if($th.attr('name') !== 'action') {
                var validation = $th.data('validation');
                if(validation != undefined) {
                    validation = validation.split(',');
                    editableRecord.validation[keyName] = validation;
                }
            }
        });
    }

    function doValidate(editableRecord, row){
        var result = true;
        var keys = getKeys(editableRecord);
        $(row).find('td').each(function(idx, td){
            if (!$(td).hasClass('action')){
                var typePlugin = getTypePlugin(td);
                var name = keys[idx];
                if(editableRecord.validation.hasOwnProperty(name)){
                    result = result && typePlugin.validate(editableRecord.validation[name], td);
                }else {
                    result = result && true;
                }
            }
        });
        return result;
    }

    //data types
    $.fn.editableRecord.typePlugins = {};

    $.fn.editableRecord.typePlugins.text = {

        makeEditable : function (field) {
            var $field = $(field),
                value = $field.text();

            $field.attr('data-value', value);
            var inputWrapper = $('<div class="ui fluid transparent input"></div>');
            var inputField = inputWrapper.append($('<input type="text" />').val(value));

            return inputField;
        },

        isChanged : function (field){
            return field.attr('data-value') !== field.find('input').val();
        },

        fieldSaved: function (field){
            var value = $(field).find('input').val();
            $(field).attr('data-value', value);
        },

        validate: function (conditions, field) {
            var result = true;
            $.each(conditions, function(idx, condition){
                switch (condition) {
                    case 'notnull' :
                        var $input = $(field).find('input');
                        result = $input.val() != '';
                        break;
                    default :
                        result = false;
                        break;
                }
            });
            return result;
        }
    };

    $.fn.editableRecord.typePlugins.email = $.extend({}, $.fn.editableRecord.typePlugins.text, {
        makeEditable : function (field) {
            var $field = $(field),
                value = $field.text();

            $field.attr('data-value', value);
            var inputWrapper = $('<div class="ui fluid transparent input"></div>');
            var inputField = inputWrapper.append($('<input type="email" />').val(value));
            return inputField
        }
    });

    $.fn.editableRecord.typePlugins.number = $.extend({}, $.fn.editableRecord.typePlugins.text, {
        makeEditable : function (field) {
            var $field = $(field),
                value = $field.text();

            $field.attr('data-value', value);
            var inputWrapper = $('<div class="ui transparent input"></div>');
            var inputField = inputWrapper.append($('<input type="number" />').val(value));
            return inputField
        }
    });

    $.fn.editableRecord.typePlugins.date = $.extend({}, $.fn.editableRecord.typePlugins.text, {
        makeEditable: function(field){
            var $field = $(field),
                value = $field.text();

            $field.attr('data-value', value);
            var inputWrapper = $('<div class="ui transparent input"></div>');
            var inputField = inputWrapper.append($('<input type="date"/>').val(value));
            return inputField
        }
    });

    $.fn.editableRecord.typePlugins.checkbox = $.extend({}, $.fn.editableRecord.typePlugins.text, {
        makeEditable : function (field) {
            var $field = $(field),
                value = $field.text(),
                checkedValue = $field.data('checked'),
                uncheckedValue = $field.data('unchecked');

            $field.attr('data-value', value);
            var inputWrapper = $('<div class="ui checkbox"></div>');
            var inputField = inputWrapper.append($('<input type="checkbox"/>').attr('checked', checkedValue === value).val(value))
                                         .append('<label>'+value+'</label>');
            inputField.checkbox({
                onChecked: function(){
                    var $this = $(this);
                    $this.val(checkedValue);
                    $this.next().html(checkedValue);
                },
                onUnchecked: function(){
                    var $this = $(this);
                    $this.val(uncheckedValue);
                    $this.next().html(uncheckedValue);
                }
            });
            return inputField
        },

        isChanged: function(field){
            return field.data('value') !== field.find('input').val();
        }
    });

    $.fn.editableRecord.typePlugins.color = $.extend({}, $.fn.editableRecord.typePlugins.text,{
        makeEditable : function (field) {
            var $field = $(field),
                value = $field.text();

            $field.attr('data-value', value);
            var inputWrapper = $('<div class="ui fluid transparent input"></div>');
            var inputField = inputWrapper.append($('<input type="color" />').val(value));

            return inputField
        }
    });

    //todo load value from text
    $.fn.editableRecord.typePlugins.select = $.extend({}, $.fn.editableRecord.typePlugins.text, {
        makeEditable: function (field) {
            var $field = $(field),
                value = $field.text(),
                defaultValue = $field.data('defaultvalue'),
                defaultLable = $field.data('defaultlable'),
                optionsFunction = $field.data('options');

            var options = window[optionsFunction]();

            $field.attr('data-value', value);
            var inputField = $('<select class="ui dropdown"></select>'),
                defaultOption = $('<option></option>');
            defaultOption.val(defaultValue);
            defaultOption.text(defaultLable);
            inputField.append(defaultOption);

            $.each(options, function(idx, elem){

                var option = $('<option></option>');
                option.val(elem.value);
                option.text(elem.text);
                if(elem.value === value){
                    option.attr('selected', true);
                }
                inputField.append(option);
            });

            inputField.dropdown();
            return inputField;
        },

        isChanged: function(field) {
            return field.data('value') !== field.find('select').val();
        },

        validate: function (conditions, field) {
            var result = true;
            $.each(conditions, function(idx, condition){
                switch (condition) {
                    case 'notnull' :
                        var $input = $(field).find('select');
                        result = $input.val() != '';
                        break;
                    default :
                        result = false;
                        break;
                }
            });
            return result;
        }
    })

}(jQuery));