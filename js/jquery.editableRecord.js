/**
 $.editableRecord()
 */
(function($) {

  var methods = {
    init : function(options) {
      if(this.length == 0) return;

      var defaults = {
        recordSelector : '.record',
        fieldSelector : '.editable',
        collectionSelector : 'tbody.main',
        templateSelector : 'tbody.template tr',
        templateRemovalSelector : 'tbody.template',
        deleteLinkSelector : 'td:last-child',
        idName : null,
        buttonAppender : null,
        multiple : true,
        addable : true, // Only relevant if multiple = true
        createUrl : null,
        updateUrl : null,
        saveUrl : null,
        preCreate : function(data) { return data }, // Before a new entity is saved. Returning false cancelles save
        preUpdate : function(data) { return data }, // Before an existing entity is updated. Returning false cancelles save
        preSave : function(data) { return data },   // Before a new or existing entity is saved. Returning false cancelles save
        postCreate : jQuery.noop,                   // After a new entity has been saved
        postUpdate : jQuery.noop,                   // After an existing entity has been updated
        postSave : jQuery.noop,                     // After a new or existing entity has been saved
        onCancel : jQuery.noop,                     // When the cancel button is hit
        preDelete : jQuery.noop,                    // Before deletion of an existing entity. Returning false cancelles deletion
        postDelete : jQuery.noop,                   // After deletion of an existing entity
        handleErrors : jQuery.noop,                 // Invoked when errors occurred
        onChange : jQuery.noop,
        postSaveComplete: jQuery.noop,              // Customize function fires when save complete
        newButtonClicked: jQuery.noop,              // Fires when "New" button clicked
        hookLabels : true
      };

      var data = this.data('editableRecord');

      if (!data) {
        var data = $.extend({
          target : this
        }, defaults, options || {});

        this.data('editableRecord', data);

        if (data.idName === null) {
          data.idName = this.attr('data-idname');
          if(data.idName === undefined) {
            console.error("Record id not set!");
          }
        }

        if (data.buttonAppender == null) {
          initDefaultButtonAppender(data);
        }

        if (data.multiple) {
          data.collection = $(data.collectionSelector, this);
          data.records = $(data.recordSelector, data.collection);
        } else {
          data.records = $(data.recordSelector, this);
        }

        data.records.each(function(idx, record) {
          makeEditable(data, record);
        });

        if (data.multiple && data.addable) {
          data.template = $(data.templateSelector, this);
          $(data.templateRemovalSelector, this).remove();
          appendAddButton(data);
        }

        appendButtons(data);
      }
      return this;
    },

    destroy : function() {
      return this.each(function() {
        $(window).unbind('.editableRecord');
        $this.removeData('editableRecord');
        // TODO: Remove data from fields (textarea has data for example)
      })
    },

    cancelClicked : function() {
      revertRecords(this.data('editableRecord'));
    },

    deleteClicked : function() {
        deleteRecord(this.data('editableRecord'), $('.record').get(0));
    },

    saveClicked : function() {
      saveRecords(this.data('editableRecord'));
    },

    forceChanged : function() {
      var data = this.data('editableRecord');
      data.forceChanged = true;
      showButtons(data);
    },

    getChangedFields: function(record, data) {
      return _(record.fields.get()).filter(function(field) {
        var typePlugin = getDataTypePlugin(field);
        return typePlugin.isChanged(data, field);
      });
    },


   reloadField: function(record, data, field) {
      return makeFieldEditable(record, data, field, undefined);
  }
};

  function initDefaultButtonAppender(data) {
    var buttonDiv = $('<div class="buttons"></div>');
    buttonDiv.insertAfter(data.target);
    data.buttonAppender = function(button, record) {
      buttonDiv.append(button);
    }
  }

  function appendButtons(data) {
    if (shouldAppendDeleteButton()) {
      data.deleteButton = $('<button class="delete">Delete</button>').bind('click.editableRecord', function(){
        methods.deleteClicked.call(data.target);
      });
      data.buttonAppender(data.deleteButton, data.records.first());
      data.deleteButton.uiButtonLoader(); // TODO: Remove this
    }
    data.cancelButton = $('<button class="cancel">Cancel</button>').bind('click.editableRecord', function(){
      methods.cancelClicked.call(data.target);
    });
    data.buttonAppender(data.cancelButton, data.records.first());
    data.cancelButton.uiButtonLoader(); // TODO: Remove this

    data.saveButton = $('<button accesskey="s" class="save">Save</button>').bind('click.editableRecord', function(){
      methods.saveClicked.call(data.target);
    });
    data.buttonAppender(data.saveButton, data.records.first());
    data.saveButton.uiButtonLoader(); // TODO: Remove this

    hideButtons(data);
  }

  function shouldAppendDeleteButton(data) {
   return $('.record').hasClass('single-deletable-record');
  }

  function appendAddButton(data) {
    data.addButton = $('<button class="new">New</button>').bind(
        'click.editableRecord', function() {
          addRecord(data);
        });
    data.buttonAppender(data.addButton, data.records.first());
    data.addButton.uiButtonLoader();
  }

  function addRecord(data) {
    var record = data.template.clone();
    data.collection.append(record);
    makeEditable(data, record);
    $('input', record).first().focus();
    data.records.push(record);
    data.newButtonClicked(record);
  }

  function saving(data) {
    data.cancelButton.hide();
    data.saveButton.button('disable');
    data.saveButton.button('option',{label:'Saving…'});
    $('input, select, textarea', data.records).prop('disabled', true);
  }

  function saveComplete(data) {
    hideButtons(data);
    data.saveButton.button('option',{label:'Save'});
    data.saveButton.button('enable');
    $('input, select, textarea', data.records).prop('disabled', false);
    data.postSaveComplete();
  }

  function hideButtons(data) {
    data.saveButton.hide();
    data.cancelButton.hide();
  }

  function showButtons(data) {
    data.saveButton.show();
    data.cancelButton.show();
  }

  function makeEditable(data, record) {
    record.fields = $(data.fieldSelector, record);
    record.fields.each(function(index, field) {
      makeFieldEditable(record, data, field, index)
    });
    addDeleteLinkIfEnabled(data, record);
  }

  function makeFieldEditable(record, data, field, index) {
    var dataTypePlugin = getDataTypePlugin(field)
    var fieldData = dataTypePlugin.makeEditable(data, field);
    var input = field.input = fieldData.input;

    hookLabelsIfEnabled(data, field, fieldData.labelFor);
    addPossibleChangeEvents(data, record, input);

    var $field = $(field);

    $field.empty().append(fieldData.content);

    // TODO: Fix this hack.
    // Move the label for checkboxes after the checkbox, and hook to input.
    if ($field.attr('data-type') == 'checkbox' && $field.attr('data-label') != "") {
      input.attr('id', 'field-' + index);
      $('#' + $field.attr('data-label')).appendTo($field).attr('for', 'field-' + index);
      ;
    }
  }

  function hookLabelsIfEnabled(data, field, labelFor) {
    var $field = $(field);
    if(labelFor == undefined) return;
    var label = $('label', $field.parent());
    if(label.length == 0) return;
    if(data.hookLabels && $field.attr('data-nolabel') != "true") {
      if(labelFor.attr('id') == "") {
        labelFor.attr('id', 'field-' + Math.floor(Math.random() * 999999)); // TODO: Improve unique id generation?
      }
      label.attr('for', labelFor.attr('id'));
    }
  }

  function addPossibleChangeEvents(data, record, input) {
    input.bind('change.editableRecord keyup.editableRecord', function() {
      recordPossiblyEdited(data, record);
    });
  }

  function addDeleteLinkIfEnabled(data, record) {
    if ($(record).hasClass('deletable')) {
      record.deleteLink = $('<a class="action delete">del</a>').appendTo($(data.deleteLinkSelector, record)).bind('click.editableRecord', function() {
        deleteRecord(data, record);
      }).uiButtonLoader();
    }
  }

  function getDataTypePlugin(field) {
    var dataType = $(field).data("type");
    if(dataType == undefined) {
      dataType = "text";
    }

    var typePlugin = $.fn.editableRecord.typePlugins[dataType];
    if(typePlugin == undefined) {
      console.error("No typePlugin found for type '" + dataType + "'");
    }
    return typePlugin;
  }

  function deleteRecord(data, record) {
    if (isRecordNew(record)) {
      removeRecordFromDom(data, record);
      return;
    }

    var result = data.preDelete($(record));
    if(result === false) return;
    var postData = {};
    postData[data.idName] = $(record).attr('data-id');
    $.extend(postData, result);
    $.ajax({
      type : 'POST',
      url : data.deleteUrl,
      cache : false,
      data : postData,
      dataType : 'json',
      success : function(result) {
        removeRecordFromDom(data, record);
        data.postDelete();
      }
    });
  }

  function removeRecordFromDom(data, record) {
    data.records = data.records.filter(function(idx, val) {
      return val != record;
    });
    $(record).remove();
  }

  function isChanged(data, record) {
    for (i = 0; i < record.fields.size(); i++) {
      var field = record.fields.get(i),
          typePlugin = getDataTypePlugin(field);
      if(typePlugin.isChanged(data, field)) {
        return true;
      }
    }
    return false;
  }

  function recordPossiblyEdited(data, record) {
    if (isChanged(data, record) || $('input', record).hasClass('error')) {
      showButtons(data);
      data.onChange(data, record);
    }
  }

  function revertRecords(data) {
    $(data.records).each(function(idx, record) {
      if (isChanged(data, record)) {
        revertRecord(data, record);
      }
    });
    data.onCancel();
    data.forceChanged = false;
    hideButtons(data);
  }

  function revertRecord(data, record) {
    $(record.fields).each(function(idx, field) {
      var typePlugin = getDataTypePlugin(field);
      typePlugin.fieldReverted(data, field);
    });
  }

  function saveRecords(data) {
    saving(data);
    data.handledErrors = {};
    data.unhandledErrors = {};
    var requests = [];
    $(data.records).each(function(idx, record) {
      if (isChanged(data, record) || data.forceChanged || data.multiple == false) {
        var requestOrFalse = saveRecord(data, record);
        if(requestOrFalse !== false) {
          requests.push(requestOrFalse);
        }
      }
    });

    $.waitForAll(requests, function(args) {
      removeTopErrors(data);

      data.handleErrors(data.unhandledErrors);

      allTopErrors = [];
      for(error in data.unhandledErrors){
        allTopErrors[allTopErrors.length] = data.unhandledErrors[error];
      }

      for(error in data.handledErrors) {
        allTopErrors[allTopErrors.length] = data.handledErrors[error];
      }

      if(allTopErrors.length) {
        showTopErrors(data, allTopErrors.reverse());
      }

      saveComplete(data);
    });
  }

  function saveRecord(data, record) {
    var postData = {}
    var isNew = isRecordNew(record);

    if (!isNew) {
      postData[data.idName] = $(record).attr('data-id');
    } else {
      postData = addRecordParams(data, record, postData);
    }

    record.fields.each(function(idx, field) {
      var typePlugin = getDataTypePlugin(field);
      postData = typePlugin.addPostData(data, field, postData);
    });

    if(isNew) {
      postData = data.preCreate(postData);
      if(postData == false) return false;
    } else {
      postData = data.preUpdate(postData);
      if(postData == false) return false;
    }
    postData = data.preSave(postData);
    if(postData == false) return false;

    var request = $.ajax({
      type : 'POST',
      url : isNew ? (data.createUrl ? data.createUrl : data.saveUrl) : (data.updateUrl ? data.updateUrl : data.saveUrl),
      data : postData,
      cache : false,
      dataType : 'json',
      success : function(result) {
        if (isNew) {
          $(record).attr('data-id', result[data.idName]);
        }

        id = result ? result[data.idName] : null;

        if (isNew) {
          data.postCreate(result, id, record);
        } else {
          data.postUpdate(result, id);
        }
        data.postSave(result, id);

        recordSaved(data, record);
      },
      error : function(request) {
        handleErrors(request, data, record);
      }
    });
    return request;
  }

  function handleErrors(request, data, record) {
    removeFieldErrors(data, record);
    if(request.status == 500) {
      errors = {'main' : ["An error has occurred. Please contact the system administrator if this problem persists."]};
    } else {
      errors = $.parseJSON(request.responseText);
    }
    var handledErrors = {};
    var unhandledErrors = {};
    $.each(errors, function(key, errorstrings) {
      var handled = false;
      $.each(record.fields, function(idx, field) {
        if ($(field).attr('data-name') == key || $(field).attr('data-name') == key+'.id') {
          handled = true;
          var typePlugin = getDataTypePlugin(field);
          typePlugin.showErrors(data, field, errorstrings);
        }
      });
      if(handled) {
        handledErrors[key] = errorstrings;
      } else {
        unhandledErrors[key] = errorstrings;
      }
    });
    data.handledErrors = $.extend(handledErrors, data.handledErrors);
    data.unhandledErrors = $.extend(unhandledErrors, data.unhandledErrors);
  }

  function addRecordParams(data, record, postData) {
    var string = $(record).attr('data-params');
    if (string != undefined) {
      var parts = string.split('|');
      $.each(parts, function(idx, part) {
        var eqPos = part.indexOf('=');
        if (eqPos != -1) {
          postData[part.substr(0, eqPos)] = part.substr(eqPos + 1);
        }
      });
    }
    return postData;
  }

  function isRecordNew(record) {
    return $(record).attr('data-id') == 'new';
  }

  function recordSaved(data, record) {
    $(record.fields).each(function(idx, field) {
      var typePlugin = getDataTypePlugin(field);
      typePlugin.hideErrors(data, field);
      typePlugin.fieldSaved(data, field);
    });
  }

  function showTopErrors(data, errors) {

    if (data.errorBox == null) {
      data.errorBox = $('<div class="error"></div>').insertBefore(data.target);
    }
    data.errorBox.html(errors.join("<br />"));
  }

  function removeTopErrors(data) {
    if (data.errorBox != null) {
      data.errorBox.remove();
      data.errorBox = null;
    }
  }

  function removeFieldErrors(data, record) {
    $(record.fields).each(function(fieldidx, field) {
      var typePlugin = getDataTypePlugin(field);
      typePlugin.hideErrors(data, field);
    });
  }

  $.fn.editableRecord = function(method) {
    if (methods[method]) {
      return methods[method].apply(this, Array.prototype.slice.call(arguments,
          1));
    } else if (typeof method === 'object' || !method) {
      return methods.init.apply(this, arguments);
    } else {
      $.error('Method ' + method + ' does not exist on jQuery.editableRecord');
    }
  };

  $.fn.editableRecord.typePlugins = {}
  $.fn.editableRecord.typePlugins.text = {
    makeEditable : function(data, field) {
      var $field = $(field),
          value = $field.text(),
          placeholder = $field.data('placeholder');

      $field.attr('data-value', value);
      var input = $('<input type="text" />').val(value);
      if(placeholder) input.attr('placeholder', placeholder);
      return {
        content : input,
        input : input,
        labelFor : input
      }
    },

    isChanged : function(data, field) {
      return (field.input.val() != $(field).attr('data-value'));
    },

    fieldSaved : function(data, field) {
      $(field).attr('data-value', field.input.val());
    },

    fieldReverted : function(data, field) {
      field.input.val($(field).attr('data-value'));
    },

    addPostData : function(data, field, postData) {
      var $field = $(field);
      if(!$field.attr('data-name')) return postData;
      postData[$field.attr('data-name')] = field.input.val();
      return postData;
    },

    showErrors : function(data, field, errors) {
      field.input.attr('title', errors.join(" - "));
      $(field).addClass('error');
    },

    hideErrors : function(data, field) {
      field.input.removeAttr('title');
      $(field).removeClass('error');
    }
  };

  $.fn.editableRecord.typePlugins.email = $.extend({}, $.fn.editableRecord.typePlugins.text, {
    makeEditable : function(data, field) {
      var $field = $(field),
          value = $field.text();

      $field.attr('data-value', value);
      var input = $('<input type="email" />').val(value);
      return {
        content : input,
        input : input,
        labelFor : input
      }
    }
  });

    $.fn.editableRecord.typePlugins.color = $.extend({}, $.fn.editableRecord.typePlugins.text, {
        makeEditable : function(data, field) {
            var $field = $(field),
                value = $field.text();

            $field.attr('data-value', value);
            var input = $('<input type="color" />').val(value);
            return {
                content : input,
                input : input,
                labelFor : input
            }
        }
    });

  $.fn.editableRecord.typePlugins.number = $.extend({}, $.fn.editableRecord.typePlugins.text, {
    makeEditable : function(data, field) {
      var $field = $(field),
          value = $field.text(),
          placeholder = $field.data('placeholder');

      $field.attr('data-value', value);
      var input = $('<input type="number" />').val(value);
      if(placeholder) input.attr('placeholder', placeholder);
      if($field.data('min') !== undefined) input.attr('min', $field.data('min'));
      if($field.data('max') !== undefined) input.attr('max', $field.data('max'));

      return {
        content : input,
        input : input,
        labelFor : input
      }
    }
  });

  $.fn.editableRecord.typePlugins.checkbox = $.extend({}, $.fn.editableRecord.typePlugins.text, {
    makeEditable : function(data, field) {
      var $field = $(field),
          inputBox = $('<div></div>'),
          checkbox = $('<input type="checkbox" />').attr('checked', $field.attr('data-checked') == 'true').appendTo(inputBox);

      // TODO: Look at this genlabel mess
      if($field.attr('data-genlabel')) {
        var cbId = 'checkbox-' + $field.attr('data-name');
        checkbox.attr('id', cbId);
        $('<label></label>').attr('for', cbId).text($field.attr('data-genlabel')).appendTo(inputBox);
      }

      return {
        content : inputBox.children(),
        input : inputBox.children('input'),
        labelFor : inputBox.children('input')
      }
    },

    isChanged : function(data, field) {
      return ($("input:checked", field).val() != ($(field).attr('data-checked') == 'true'));
    },

    fieldSaved : function(data, field) {
      $(field).attr('data-checked', ($('input', field).is(':checked')));
    },

    fieldReverted : function(data, field) {
      field.input.attr('checked', $(field).attr('data-checked') == 'true');
    },

    addPostData : function(data, field, postData) {
      var $field = $(field);
      if(!$field.attr('data-name')) return postData;

      // If the checkbox has a data-value attribute, send that
      // value when checked
      if ($field.attr('data-value')) {
        if (field.input.attr('checked')) {
          postData[$field.attr('data-name')] = $field.attr('data-value');
        }
        // If the checkbox does not have a data-value attr, send
        // true or false
      } else {
        postData[$field.attr('data-name')] = field.input.attr('checked') ? 'true' : 'false';
      }
      return postData;
    }
  });

  $.fn.editableRecord.typePlugins.password = $.extend({}, $.fn.editableRecord.typePlugins.text, {
    makeEditable : function(data, field) {
      var input = $('<input type="password" />');
      return {
        content : input,
        input : input,
        labelFor : input
      }
    },

    isChanged : function(data, field) {
      return field.input.val() != "";
    },

    fieldSaved : function(data, field) {
      field.input.val('');
    },

    fieldReverted : function(data, field) {
      field.input.val("");
    },

    addPostData : function(data, field, postData) {
      var $field = $(field);
      if(!$field.attr('data-name')) return postData;

      if(this.isChanged(data, field)) {
        postData[$field.attr('data-name')] = field.input.val();
      }
      return postData;
    }
  });

  $.fn.editableRecord.typePlugins.textarea = $.extend({}, $.fn.editableRecord.typePlugins.text, {
    makeEditable : function(data, field) {
      var $field = $(field),
          value = $field.text();
      $field.data('value', value);
      var input = $('<textarea></textarea>').val(value);

      return {
        content : input,
        input : input,
        labelFor : input
      }
    },

    isChanged : function(data, field) {
      return field.input.val() != $(field).data('value');
    },

    fieldSaved : function(data, field) {
      $(field).data('value', field.input.val());
    },

    fieldReverted : function(data, field) {
      field.input.val($(field).data('value'));
    },

    addPostData : $.fn.editableRecord.typePlugins.text.addPostData

  });

  $.fn.editableRecord.typePlugins.date = $.extend({}, $.fn.editableRecord.typePlugins.text, {
    makeEditable : function(data, field) {
      var value = $(field).text();
      $(field).attr('data-value', value);
      var input = $('<input type="text" class="date" />').val(value);

      if(input.attr('id') == "") {
        input.attr('id', 'field-' + Math.floor(Math.random() * 999999)); // TODO: Improve unique id generation?
      }
      input.datepicker({
        dateFormat : 'dd-mm-yy',
        firstDay: 1
      });

      return {
        content : input,
        input : input,
        labelFor : input
      }
    }
  });

  $.fn.editableRecord.typePlugins.time = $.extend({}, $.fn.editableRecord.typePlugins.text, {
    makeEditable : function(data, field) {
      var $field = $(field);
      var value = $field.text(),
          inputBox = $('<div></div>'),
          parts = value.split(':'),
          hoursSet = parts[0];

      var minutesSet;
      if(parts[1]) {
        minutesSet = parts[1];
      } else {
        minutesSet = "";
      }

      var hoursInput = $('<select class="hours"></select>');
      $('<option value=""></option>').appendTo(hoursInput);
      for(n = 0; n <= 23; n++) {
        var val = pad(n, 2);
        var option = $('<option value="' + val + '">' + val + '</option>').appendTo(hoursInput);
        if(val == hoursSet) option.attr('selected', 'selected');
      }
      var minutesInput = $('<select class="minutes"></select>');
      $('<option value=""></option>').appendTo(minutesInput);
      for(i = 0; i <= 59; i+=5) {
        var val = pad(i, 2);
        var option = $('<option value="' + val + '">' + val + '</option>').appendTo(minutesInput);
        if(val == minutesSet) option.attr('selected', 'selected');
      }

      hoursInput.appendTo(inputBox);
      minutesInput.appendTo(inputBox);
      $field.attr('data-value', value);
      var content = inputBox.children();
      return {
        content: content,
        input : content,
        labelFor : hoursInput
      }
    },

    isChanged : function(data, field) {
      return $('select.hours', field).val() + ':' + $('select.minutes', field).val() != $(field).attr('data-value');
    },

    fieldSaved : function(data, field) {
      $(field).attr('data-value', $('select.hours', field).val() + ':' + $('select.minutes', field).val());
    },

    fieldReverted : function(data, field) {
      var $field = $(field);
      var parts = $field.attr('data-value').split(':');
      $('select.hours', $field).val(parts[0]).change();
      if (parts.length < 2)
        parts[1] = "";
      $('select.minutes', $field).val(parts[1]).change();
    },

    addPostData : function(data, field, postData) {
      var $field = $(field);
      if($field.attr('data-name') == null) return postData;
      var timeString = $('select.hours', field).val() + ':' + $('select.minutes', field).val();
      if(timeString != ':') {
        postData[$field.attr('data-name')] = timeString;
      }
      return postData;
    }
  });

  $.fn.editableRecord.typePlugins.select = $.extend({}, $.fn.editableRecord.typePlugins.text, {
    makeEditable : function(data, field) {
      var $field = $(field);
      var $input = $('<select />');

      var canBeEmpty = $field.attr('data-canbeempty');
      if(canBeEmpty == "true") {
        var $emptyOption = $('<option value=""></option>');
        $emptyOption.text($(field).data("emptylabel"))
        $emptyOption.appendTo($input);
      }

      var emptyGroupLabel = $(field).data("emptygrouplabel");
      var selectSet = false;


        var toOption = function (object) {
          var option = $('<option></option>');
          option.text(object.name);
          option.attr('value', object.id);
          if (object.id == $field.attr('data-value') && !selectSet) {
            option.attr('selected', 'selected');
            selectSet = true
          }
          if (object.deleted === true) {
            option.prop('disabled', 'disabled');
          }

          return option;
        };

        var toOptgroup = function(options, label) {
          var $optgroup = $("<optgroup/>");
          $optgroup.attr("label", label);
          var optionElems = _(options).map(toOption);

          if(optionElems.length == 0) {
            $optgroup.append($("<option disabled='true'/>").text(emptyGroupLabel));
          }
          _(optionElems).each(function(elem){
            $optgroup.append(elem);
          });

          return $optgroup
        };

      var callbackFunction = function(options) {
        _(_(options).map(_(options).isArray() ? toOption : toOptgroup)).each(function(elem) {
          $input.append(elem);
        });
      };

      // Switch between synchronous data (data-source), and asynchronous data (data-source-async)
      if($field.attr('data-source')) {
        optionsFunctionString = $field.attr('data-source');
        if(!window[optionsFunctionString]) {
          console.error("Missing select data function " + optionsFunctionString + " for field", $field);
        }
        options = window[optionsFunctionString].apply(this, [$field]);
        callbackFunction(options);
      } else if($field.attr('data-source-async')) {
        optionsFunctionString = $field.attr('data-source-async');
        if(!window[optionsFunctionString]) {
          console.error("Missing select data function " + optionsFunctionString + " for field", $field);
        }
        window[optionsFunctionString].apply(this, [$field, callbackFunction]);
      }

      return {
        content : $input,
        input : $input,
        labelFor : $input
      }

    }
  });

  $.fn.editableRecord.typePlugins.radio = $.extend({}, $.fn.editableRecord.typePlugins.text, {
    makeEditable : function(data, field) {
      var $field = $(field);
      var rowIndex = $field.parent().index();
      optionsFunctionString = $field.attr('data-source');
      if(!window[optionsFunctionString]) {
        console.error("Missing radio data function " + optionsFunctionString + " for field", $field);
      }
      options = window[optionsFunctionString].apply(this, [$field]);

      var inputBox = $('<form></form>');

      $(options).each(function(idx, object) {
        var radioName = $field.attr('data-name');
        var radioId = radioName + '-' + object.id;
        var label = $('<label></label>').attr('for', radioId + "-" + rowIndex).text(object.name);
        var radio = $('<input type="radio"></input>');
        radio.attr('id', radioId + "-" + rowIndex).attr('name', radioName).attr('value', $field.attr('id'));
        radio.val(object.id);

        if(object.id == $field.attr('data-value')) {
          radio.attr('checked', 'checked');
        }

        radio.appendTo(inputBox);
        label.appendTo(inputBox);

      });
      return {
        content : inputBox,
        input : inputBox.children('input')
        // No labelFor, as these have their own labels.
      }
    },

    isChanged : function(data, field) {
      return $("input:checked", field).val() != $(field).attr('data-value')
    },

    fieldSaved : function(data, field) {
      $(field).attr('data-value', ($("input:checked", field).val()));
    },

    fieldReverted : function(data, field) {
      $field = $(field);
      $("input:checked", $field).removeAttr('checked');
      $('input[value="' + $field.attr('data-value') + '"]', field).attr('checked', true);
    },

    addPostData : function(data, field, postData) {
      postData[$(field).attr('data-name')] = $("input:checked", field).val();
      return postData;
    }
  });

  $.fn.editableRecord.typePlugins.singleradio = $.extend({}, $.fn.editableRecord.typePlugins.text, {
    makeEditable : function(data, field) {
      var $field = $(field);

      var inputBox = $('<div></div>');

      var radioName = $field.attr('data-name');
      var radio = $('<input type="radio"></input>');
      radio.attr('name', radioName).attr('value', $field.attr('data-checkedvalue'));

      if($field.attr('data-value') == $field.attr('data-checkedvalue')) {
        radio.attr('checked', 'checked');
      }

      radio.appendTo(inputBox);

      return {
        content : inputBox.children(),
        input : inputBox.children('input')
      }
    },

    isChanged : function(data, field) {
      var $field = $(field);
      var oldChecked = $field.attr('data-value') == $field.attr('data-checkedvalue');
      var newChecked = $('input', field).is(':checked');
      return oldChecked != newChecked;
    },

    fieldSaved : function(data, field) {
      var $field = $(field);
      var name = $field.attr('data-name');
      $(field).attr('data-value', ($("input[name=" + name + "]:checked").val()));
    },

    fieldReverted : function(data, field) {
      var $field = $(field);
      var oldChecked = $field.attr('data-value') == $field.attr('data-checkedvalue');

      if($('input', field).is(':checked')) {
        if(!oldChecked) {
          $('input', field).removeAttr('checked');
        }
      } else {
        if(oldChecked) {
          $('input', field).attr('checked', 'checked');
        }
      }
    },

    addPostData : function(data, field, postData) {
      if($('input:checked', field).size()) {
        postData[$(field).attr('data-name')] = $("input:checked", field).val();
      }
      return postData;
    }
  });

  $.fn.editableRecord.typePlugins.datetime = $.extend({}, $.fn.editableRecord.typePlugins.text, {
    makeEditable : function(data, field) {
      var value = $(field).text(),
          inputBox = $('<div></div>'),
          parts = value.split(' ', 2),
          datePart = parts[0],
          timePart = parts[1];

      if(timePart === undefined) timePart = ":";

      // Date Parts: TODO, see what we can reuse from the 'date' type
      $(field).attr('data-value', value);
      var input = $('<input type="text" class="date" />').val(datePart);
      if(input.attr('id') == "") {
        input.attr('id', 'field-' + Math.floor(Math.random() * 999999)); // TODO: Improve unique id generation?
      }
      input.datepicker({
        dateFormat : 'dd-mm-yy'
      });

      input.appendTo(inputBox);

      // Time Part: TODO, see what we can reuse from the 'time' type
      parts = timePart.split(':', 2),
      hoursSet = parts[0];
      minutesSet = parts[1];

      if(minutesSet === undefined) minutesSet = null;

      var hoursInput = $('<select class="hours"></select>');
      $('<option value=""></option>').appendTo(hoursInput);
      for(n = 0; n <= 23; n++) {
        var val = pad(n, 2);
        var option = $('<option value="' + val + '">' + val + '</option>').appendTo(hoursInput);
        if(val == hoursSet) option.attr('selected', 'selected');
      }
      var minutesInput = $('<select class="minutes"></select>');
      $('<option value=""></option>').appendTo(minutesInput);
      var increment = $(field).attr('data-fulltime') ? 1 : 5;
      for(i = 0; i <= 59; i+=increment) {
        var val = pad(i, 2);
        var option = $('<option value="' + val + '">' + val + '</option>').appendTo(minutesInput);
        if(val == minutesSet) option.attr('selected', 'selected');
      }

      hoursInput.appendTo(inputBox);
      minutesInput.appendTo(inputBox);
      $(field).attr('data-value', value);
      var content = inputBox.children();

      return {
        content : content,
        input : $("input, select", inputBox),
        labelFor : input
      }
    },

    isChanged : function(data, field) {
      return $('input.date', field) + ' ' + $('select.hours', field).val() + ':' + $('select.minutes', field).val() != $(field).attr('data-value');
    },

    fieldSaved : function(data, field) {
      $(field).attr('data-value', $('input.date').val() + ' ' + $('select.hours', field).val() + ':' + $('select.minutes', field).val());
    },

    fieldReverted : function(data, field) {
      var $field = $(field);
      var parts = $field.attr('data-value').split(' ', 2),
          datePart = parts[0],
          timePart = parts[1];

      // Date
      $('input.date', field).val(datePart);

      // Time
      if(timePart === undefined) timePart = ':';
      var parts = timePart.split(':');
      $('select.hours', $field).val(parts[0]).change();
      if (parts.length < 2)
        parts[1] = "";
      $('select.minutes', $field).val(parts[1]).change();
    },

    addPostData : function(data, field, postData) {
      if($(field).attr('data-name') == null) return postData;
      var dateValue = $('input.date', field).val();
      var hoursValue = $('select.hours', field).val();
      var minutesValue = $('select.minutes', field).val();

      var fullValue = "";
      if(dateValue) {
          fullValue = dateValue;
      }

      if(hoursValue || minutesValue) {
          fullValue += " " + hoursValue + ":" + minutesValue;
      }

      postData[$(field).attr('data-name')] = fullValue;

      return postData;
    }

  });
})(jQuery);

