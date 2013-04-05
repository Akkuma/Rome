(function () {
	function nope(){}
	
	function Rome() {}

	//Potential for supporting multiple registries within Rome?
	function Registry() {
		this.componentsLookup = {};
		this.components = [];
		this.instances = {};	
	}

	var self = this;
	Registry.prototype = {
		findComponent: function (name) {
			return this.componentsLookup[name] || this.componentsLookup[name.name];
		},
		addComponent: function (component) {
			if (this.componentsLookup[component.name]) return;

			this.components.push(component);
			this.componentsLookup[component.name] = component;
		},
		findInstance: function (root) {
			return this.instances[root];
		},
		addInstance: function (root, instance) {
			this.instances[root] = instance;
		}
	};

	var reg = Rome.Registry = new Registry();

	//@TODO add setter to manipulate $ if set later defineProperty
	var $ = Rome.$ = self.$;

	// Strategies are a minimal abstraction/transformation layer
	// that will allow users to replace the OOBE of Rome.
	Rome.Strategies = {
		mixin: function (obj, mixin) {
			mixin(obj);
		}
	};

	// The foundation for all components provided by Rome.
	// Allows users to provide a new foundation for functionality they want baked in.
	Rome.Foundation = (function () {
		var destroy = function () {
			this.$root.remove();
		};

		return function Foundation(obj) {
			var proto = obj.prototype;
			proto.destroy = detroy;
		};
	})();

	// Before you can erect a component you must plan for it.
	// The base component is the function you want to become a Rome component.
	// The mixins are all the functionality you want to enhance the function with.
	Rome.plan = function (baseComponent, mixins) {
		reg.addComponent(baseComponent);

		mixins = mixins.length ? mixins || [mixins];

		// We always add Rome.Foundation for common functionality in components
		mixins.push(Rome.Foundation);
		for	(var i = 0, len = mixins.length; i < len; i++) {
			var mixin = mixins[i];

			if (typeof mixin == 'string') {
				mixin = reg.findComponent(mixin);
			}

			Rome.Strategies.mixin(baseComponent, mixin);
		}

		// If Rome has already been built we want to instantly erect the newly planned component
		wasRomeBuilt && erectInstances($('[data-rome="' + baseComponent.name + '"]'));
	};

	function erectInstances($components) {
		for (var i = 0, len = $components.length; i < len; i++) {
			Rome.erect($components[i]);
		}
	}

	var wasRomeBuilt = false;
	Rome.build = function () {
		//@TODO: Remove DOM dependency - perhaps some sort of dependency analysis instead?
		erectInstances($('[data-rome]'));

		wasRomeBuilt = true;
	};

	Rome.erect = function (root) {
		
		function Component(root) {
			this.root = root;
			this.$root = $(root);
		}
		
		Rome.Strategies.mixin(reg.find(root.getAttribute('data-rome')), Component);

		reg.addInstance(root, new Component(root));
	};

	//@TODO: Global PubSub?
	Rome.Empire;
	//@TODO: Routing?
	Rome.Roads;

	//@TODO support AMD/Common
	this.Rome = Rome;
})();



var circle = function () {
	this.area
}

circle.call(Obj.prototype)

var asCircle = (func () {
	var area = function (){
		this.radius * this.pi;
	};

	return function () {
		this.area = area
	}
})()

var area = function (){}
asCircle = function () {
	this.area = area;
}

function Circle(radius) {
	this.radius = radius;
}

asCircle(Circle);

var c = new Circle(4);
c.area()


