const m = require("mithril");
const getId = require("../utils/getID");

/**
 * Convenience class, which registers required events and base methods for value-editors (not object, array)
 *
 * Usage
 * ```js
 *      MyValueEditor extends AbstractValueEditor {
 *          constructor(pointer, controller, options) {
 *              super(pointer, controller, options);
 *              this.render();
 *          }
 *          render() {
 *              m.render(this.$element, m(MyView, this.viewModel));
 *          }
 *      }
 * ```
 */
class AbstractValueEditor {

    static editorOf(pointer, controller) {
        const schema = controller.schema().get(pointer);
        return schema.type !== "object" && schema.type !== "array";
    }

    /**
     * #options
     *      - editorValueType:String - custom type of editor value (added as classname)
     *      - editorElementProperties:Object - add custom properties to main DOM-element
     *      - viewModel:Object - viewModel which extends base viewmodel
     *
     * @param  {String} pointer         - json pointer to value
     * @param  {Controller} controller  - json editor controller
     * @param  {Object} options
     */
    constructor(pointer, controller, options) {
        this.pointer = pointer;
        this.controller = controller;

        const schema = controller.schema().get(pointer);
        const type = options.editorValueType || (schema.enum ? "select" : schema.type);

        // create main DOM-element for view-generation
        this.$element = controller.createElement(`.editron-value.editron-value--${type}`, Object.assign({
            name: `editor-${pointer}`
        }, options.editorElementProperties));

        // use this model to generate the view. may be customized with `options.viewModel`
        this.viewModel = Object.assign({
            pointer,
            id: getId(pointer),
            title: options.title,
            description: options.description,
            value: controller.data().get(pointer),
            schema,
            errors: [],
            onfocus: () => controller.location().setCurrent(pointer),
            onchange: (value) => this.setValue(value)
        }, options.viewModel);

        // in order to deregister callbacks in destroy(), bind all callbacks to this class
        this.update = controller.data().observe(pointer, this.update.bind(this));
        this.addError = controller.validator().observe(pointer, this.addError.bind(this));
        this.clearErrors = controller.validator().on("beforeValidation", this.clearErrors.bind(this));

        // this.render();
    }

    getPointer() {
        return this.pointer;
    }

    updatePointer(pointer) {
        if (pointer === this.pointer) {
            return;
        }

        this.controller.changePointer(pointer, this);

        const oldPointer = this.pointer;
        this.$element.setAttribute("name", `editor-${pointer}`);
        this.pointer = pointer;
        this.viewModel.pointer = pointer;
        this.viewModel.id = getId(pointer);
        this.viewModel.onfocus = () => this.controller.location().setCurrent(pointer);
        this.controller.data().removeObserver(oldPointer, this.update);
        this.controller.validator().removeObserver(oldPointer, this.addError);
        this.controller.data().observe(pointer, this.update);
        this.controller.validator().observe(pointer, this.addError);
        // console.log("Rerender", pointer, `(${oldPointer})`);
        this.update();
    }

    // update display value in view
    update() {
        this.viewModel.value = this.controller.data().get(this.pointer);
        this.render();
    }

    // updates value in data-store
    setValue(value) {
        this.controller.data().set(this.pointer, value);
        this.render();
    }

    // adds an error to view
    addError(error) {
        this.viewModel.errors.push(error.message);
        this.render();
    }

    // removes all errors of view
    clearErrors() {
        this.viewModel.errors.length = 0;
        this.render();
    }

    // update view
    render() {
        // this.$element.innerHTML = "<b>Overwrite AbstractValueEditor.render() to generate your view</b>";
        m.render(this.$element, m("b", "Overwrite AbstractValueEditor.render() to generate view"));
    }

    // return main dom element
    toElement() {
        return this.$element;
    }

    // destroy this editor
    destroy() {
        if (this.viewModel) {
            this.controller.removeEditor(this);

            // destroy this editor only once
            m.render(this.$element, m("i"));

            this.viewModel = null;
            this.controller.data().removeObserver(this.pointer, this.update);
            this.controller.validator().removeObserver(this.pointer, this.addError);
            this.controller.validator().off("beforeValidation", this.clearErrors);
            this.$element = null;
        }
    }
}


module.exports = AbstractValueEditor;