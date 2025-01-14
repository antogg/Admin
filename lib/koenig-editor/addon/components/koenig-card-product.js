import $ from 'jquery';
import Browser from 'mobiledoc-kit/utils/browser';
import Component from '@glimmer/component';
import {
    IMAGE_EXTENSIONS,
    IMAGE_MIME_TYPES
} from 'ghost-admin/components/gh-image-uploader';
import {action} from '@ember/object';
import {isBlank} from '@ember/utils';
import {run} from '@ember/runloop';
import {inject as service} from '@ember/service';
import {set} from '@ember/object';

export default class KoenigCardProductComponent extends Component {
    @service config;
    @service feature;
    @service store;
    @service membersUtils;
    @service ui;

    files= null;
    imageExtensions = IMAGE_EXTENSIONS;
    imageMimeTypes = IMAGE_MIME_TYPES;

    get isEmpty() {
        const {productTitle, productDescription, productUrl, productButton, productImageSrc} = this.args.payload;

        return isBlank(productTitle) && isBlank(productDescription) && (isBlank(productUrl) || isBlank(productButton)) && isBlank(productImageSrc);
    }

    get isIncomplete() {
        const {productTitle, productDescription} = this.args.payload;

        return isBlank(productTitle) || isBlank(productDescription);
    }

    get toolbar() {
        if (this.args.isEditing) {
            return false;
        }

        return {
            items: [{
                buttonClass: 'fw4 flex items-center white',
                icon: 'koenig/kg-edit',
                iconClass: 'fill-white',
                title: 'Edit',
                text: '',
                action: run.bind(this, this.args.editCard)
            }]
        };
    }

    constructor() {
        super(...arguments);
        this.args.registerComponent(this);

        const payloadDefaults = {};

        Object.entries(payloadDefaults).forEach(([key, value]) => {
            if (this.args.payload[key] === undefined) {
                this._updatePayloadAttr(key, value);
            }
        });
    }

    // required for snippet rects to be calculated - editor reaches in to component,
    // expecting a non-Glimmer component with a .element property
    @action
    registerElement(element) {
        this.element = element;
    }

    @action
    registerEditor(textReplacementEditor) {
        let commands = {
            'META+ENTER': run.bind(this, this._enter, 'meta'),
            'CTRL+ENTER': run.bind(this, this._enter, 'ctrl')
        };

        Object.keys(commands).forEach((str) => {
            textReplacementEditor.registerKeyCommand({
                str,
                run() {
                    return commands[str](textReplacementEditor, str);
                }
            });
        });

        this._textReplacementEditor = textReplacementEditor;

        run.scheduleOnce('afterRender', this, this._afterRender);
    }

    _enter(modifier) {
        if (this.args.isEditing && (modifier === 'meta' || (modifier === 'crtl' && Browser.isWin()))) {
            this.args.editCard();
        }
    }

    @action
    setProductTitle(content) {
        this._updatePayloadAttr('productTitle', content);
    }

    @action
    setProductDescription(content) {
        this._updatePayloadAttr('productDescription', content);
    }

    @action
    setProductUrl(event) {
        this._updatePayloadAttr('productUrl', event.target.value);
    }

    @action
    setProductButton(event) {
        this._updatePayloadAttr('productButton', event.target.value);
    }

    @action
    leaveEditMode() {
        if (this.isEmpty) {
            // afterRender is required to avoid double modification of `isSelected`
            // TODO: see if there's a way to avoid afterRender
            run.scheduleOnce('afterRender', this, this.args.deleteCard);
        }
    }

    @action
    focusElement(selector, event) {
        event.preventDefault();
        document.querySelector(selector)?.focus();
    }

    _updatePayloadAttr(attr, value) {
        let payload = this.args.payload;

        set(payload, attr, value);

        // update the mobiledoc and stay in edit mode
        this.args.saveCard?.(payload, false);
    }

    _afterRender() {
        this._placeCursorAtEnd();
        this._focusInput();
    }

    _placeCursorAtEnd() {
        if (!this._textReplacementEditor) {
            return;
        }

        let tailPosition = this._textReplacementEditor.post.tailPosition();
        let rangeToSelect = tailPosition.toRange();
        this._textReplacementEditor.selectRange(rangeToSelect);
    }

    _focusInput() {
        let headingInput = this.element.querySelector('.kg-product-card-title .koenig-basic-html-input__editor');

        if (headingInput) {
            headingInput.focus();
        }
    }

    @action
    setPreviewSrc(files) {
        let file = files[0];
        if (file) {
            let url = URL.createObjectURL(file);
            this.previewSrc = url;

            let imageElem = new Image();
            imageElem.onload = () => {
                // store width/height for use later to avoid saving an image card with no `src`
                this._imageWidth = imageElem.naturalWidth;
                this._imageHeight = imageElem.naturalHeight;
            };
            imageElem.src = url;
        }
    }

    @action
    resetSrcs() {
        // this.set('previewSrc', null);
        this.previewSrc = null;
        // this._imageWidth = null;
        // this._imageHeight = null;

        // create undo snapshot when clearing
        this.args.editor.run(() => {
            this._updatePayloadAttr('productImageSrc', null);
            // this._updatePayloadAttr('width', null);
            // this._updatePayloadAttr('height', null);
        });
    }

    @action
    updateSrc(images) {
        let [image] = images;

        // create undo snapshot when image finishes uploading
        this.args.editor.run(() => {
            this._updatePayloadAttr('productImageSrc', image.url);
            if (this._imageWidth && this._imageHeight) {
                // this._updatePayloadAttr('width', this._imageWidth);
                // this._updatePayloadAttr('height', this._imageHeight);
            }
            this._imageWidth = null;
            this._imageHeight = null;
        });
    }

    /**
     * Opens a file selection dialog - Triggered by "Upload Image" buttons,
     * searches for the hidden file input within the .gh-setting element
     * containing the clicked button then simulates a click
     * @param  {MouseEvent} event - MouseEvent fired by the button click
     */
    @action
    triggerFileDialog(event) {
        this._triggerFileDialog(event);
    }

    _triggerFileDialog(event) {
        let target = event && event.target || this.element;

        // simulate click to open file dialog
        // using jQuery because IE11 doesn't support MouseEvent
        $(target)
            .closest('.__mobiledoc-card')
            .find('input[type="file"]')
            .click();
    }

    @action
    changeStars(event) {
        if (event.target.checked) {
            this._updatePayloadAttr('productStarRating', event.target.value);
        }
    }
}
