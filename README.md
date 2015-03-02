Semantic.editableRecord
=======================

####Support by: Lunatech BV. [http://www.lunatech.com](http://www.lunatech.com)

####by : yue.li@lunatech.com

###Description
JQuery data table plugin based on semantic UI.

###Dependencies
- [Semantic UI](http://semantic-ui.com/)
- [JQuery](http://jquery.com/)

###Installation

1. Include semantic css file between `<head>` tag.

        <link href="path/to/your/semantic.min.css" rel="stylesheet" type="text/css">

2. Include all javascript files in your page.

        <script src="path/to/your/jquery-2.1.3.min.js"></script>
        <script src="path/to/your/semantic.min.js"></script>
        <script src="path/to/your/semantic.editableRecord.js"></script>

4. Create a table

        <table id="tableId" class="ui table">
            <thead>
            <tr>
                <th name="name" data-notnull="true">Name</th>
                <th name="registrationDate">Registration Date</th>
                <th name="email">E-mail address</th>
                <th name="plan" data-notnull="true">Premium Plan</th>
            </tr>
            </thead>
            <tbody>
            <tr id="1">
                <td>John Lilki</td>
                <td data-type="date">2013-09-14</td>
                <td data-type="email">jhlilk22@yahoo.com</td>
                <td data-type="checkbox" data-checked="Yes" data-unchecked="No">No</td>
            </tr>
            <tr id="2">
                <td>Jamie Harington</td>
                <td data-type="date">2014-01-11</td>
                <td data-type="email">jamieharingonton@yahoo.com</td>
                <td data-type="checkbox" data-checked="Yes" data-unchecked="No">Yes</td>
            </tr>
            <tr id="3">
                <td>Jill Lewis</td>
                <td data-type="date">2014-11-03</td>
                <td data-type="email">jilsewris22@yahoo.com</td>
                <td data-type="checkbox" data-checked="Yes" data-unchecked="No">Yes</td>
            </tr>
            </tbody>
        </table>

5. Initialize your table and make it editable.

        $(function(){
            $('#tableId').editableRecord({
                idName: '<your id name>',
                saveUrl:'<your url to save the data>',
                deleteUrl: '<your url to delete the data>'
            });
        });

Documents
=========

Properties and Events | Description
--------------------- | -------------
idName | Your id name e.g "userId"
saveButton | `<div name="save" class="ui primary button">Save</div>`
cancellButton | `<div name="cancel" class="ui button">Cancel</div>`
newButton | `<div class="ui positive button">New</div>`
deleteButton | `<div class="ui icon button"><i class="trash icon"></i></div>`
orButton | `<div class="or"></div>`
buttonGroup | `<div class="ui buttons"></div>`
createUrl | url for create.
updateUrl | url for update.
saveUlr | url for save.
deleteUrl | url for delete.
preCreate | event fires before insert new record
preUpdate | event fires before update record
preSave | event fires before save record
preDelete | event fires before delete record
postCreate | event fires after insert new record
postUpdate | event fires after update record
postSave | event fires after save record
postDelete | event fires after delete record
errorHandler | handler error