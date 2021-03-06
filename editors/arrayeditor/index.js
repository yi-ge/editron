const m = require("mithril");
const ArrayItemEditor = require("./ArrayItemEditor");
const diffpatch = require("../../services/utils/diffpatch");
const View = require("../../components/container");


class ArrayEditor {

    static editorOf(pointer, controller) {
        const schema = controller.schema().get(pointer);
        return schema.type === "array";
    }

    constructor(pointer, controller, options = {}) {
        // add id to element, since no other input-form is associated with this editor
        options.attrs = Object.assign({ id: options.id }, options.attrs);
        const schema = controller.schema().get(pointer);
        const data = controller.data().get(pointer);

        this.onAdd = (index = 0) => {
            if (!this.viewModel.disabled) {
                controller.addItemTo(this.pointer, index);
            }
        };

        const arrayHTMLElement = ".editron-container.editron-container--array.withAddButton";
        this.$element = controller.createElement(arrayHTMLElement, options.attrs);

        this.controller = controller;
        this.pointer = pointer;
        this.children = [];
        this.viewModel = Object.assign({
            pointer,
            attrs: {},
            errors: controller.validator().getErrorsAndWarnings(pointer),
            onadd: this.onAdd,
            length: data.length,
            maxItems: schema.maxItems || Infinity,
            minItems: schema.minItems || 0
        }, options);

        this.viewModel.controls = Object.assign({
            add: false,
            remove: true,
            move: true,
            insert: true,
            showIndex: options["array:index"] === true,
            maxItems: schema.maxItems || Infinity,
            minItems: schema.minItems || 0
        }, options.controls);

        this.updateView = controller.data().observe(pointer, this.updateView.bind(this));
        this.setErrors = controller.validator().observe(pointer, this.setErrors.bind(this));

        this.render();
        this.$items = this.$element.querySelector(View.childContainerSelector);
        this.rebuildChildren();
        this.updateControls();
    }

    setActive(active = true) {
        const disabled = active === false;
        this.viewModel.disabled = disabled;
        this.viewModel.controls.disabled = disabled;
        this.rebuildChildren();
        this.render();
    }

    update() {
        this.rebuildChildren();
        this.updateControls();
    }

    updatePointer(newPointer) {
        if (this.pointer === newPointer) {
            return;
        }

        this.controller.changePointer(newPointer, this);

        const previousPointer = this.pointer;
        this.pointer = newPointer;
        this.viewModel.pointer = newPointer;
        this.viewModel.attrs.id = newPointer;

        this.controller.data().removeObserver(previousPointer, this.updateView);
        this.controller.validator().removeObserver(previousPointer, this.setErrors);
        this.controller.data().observe(newPointer, this.updateView);
        this.controller.validator().observe(newPointer, this.setErrors);

        this.children.forEach((child, index) => child.updatePointer(`${newPointer}/${index}`));
        this.render();
    }

    updateView(changeEvent) {
        if (changeEvent && changeEvent.patch) {
            this.applyPatches(changeEvent.patch);
        } else {
            this.rebuildChildren();
        }
        this.updateControls();
    }

    applyPatches(patch) {
        // fetch a copy of the original list
        const originalChildren = this.children.slice(0);
        // and patch the current list
        diffpatch.patch(this.children, patch);

        // search for inserted children
        this.children.forEach((child, index) => {
            if (child instanceof ArrayItemEditor === false) {
                const pointer = `${this.pointer}/${index}`;
                const newChild = new ArrayItemEditor(pointer, this.controller, this.viewModel.controls);
                // @insert?
                this.children[index] = newChild;
            }
        });

        // search for removed children
        originalChildren.forEach(child => {
            if (this.children.indexOf(child) === -1) {
                child.destroy();
            }
        });

        // update view: move and inserts nodes
        const currentLocation = this.controller.location().getCurrent();

        for (let i = 0, l = this.children.length; i < l; i += 1) {
            const previousPointer = this.children[i].getPointer();
            const currentPointer = `${this.pointer}/${i}`;

            // update current location
            if (currentLocation.indexOf(previousPointer) === 0) {
                const editorLocation = currentLocation.replace(previousPointer, currentPointer);
                this.controller.location().setCurrent(editorLocation);
            }

            // update child views to match patched list
            this.children[i].updatePointer(currentPointer);
            if (this.$items.children[i] === this.children[i].toElement()) {
                // skip moving node, already in place
                continue;
            } else if (i + 1 < this.$items.children.length) {
                // move node to correct position
                this.$items.insertBefore(this.children[i].toElement(), this.$items.children[i + 1]);
            } else {
                // remaining nodes may be simply appended
                this.$items.appendChild(this.children[i].toElement());
            }
        }
    }

    rebuildChildren() {
        const data = this.controller.data().get(this.pointer);

        // delete all child editors
        this.children.forEach(editor => editor.destroy());
        this.children.length = 0;
        this.$items.innerHTML = "";

        // recreate child editors
        data.forEach((item, index) => {
            const childPointer = `${this.pointer}/${index}`;
            const childEditor = new ArrayItemEditor(childPointer, this.controller, this.viewModel.controls);
            this.$items.appendChild(childEditor.toElement());
            this.children.push(childEditor);
        });
    }

    updateControls() {
        this.viewModel.length = this.children.length;
        this.viewModel.onadd = this.viewModel.maxItems > this.children.length ? this.onAdd : false;

        this.$element.classList.toggle("has-add-disabled", this.viewModel.maxItems <= this.children.length);
        this.$element.classList.toggle("has-remove-disabled", this.viewModel.minItems >= this.children.length);
    }

    getPointer() {
        return this.pointer;
    }

    setErrors(errors) {
        this.viewModel.errors = errors;
        this.render();
    }

    render() {
        m.render(this.$element, m(View, this.viewModel));
    }

    toElement() {
        return this.$element;
    }

    destroy() {
        if (this.viewModel) {
            this.controller.removeInstance(this);

            this.viewModel = null;
            m.render(this.$element, m("i"));
            this.controller.data().removeObserver(this.pointer, this.updateView);
            this.controller.validator().removeObserver(this.pointer, this.setErrors);
            this.children.forEach(editor => editor.destroy());
        }
    }
}


module.exports = ArrayEditor;
