"use strict";

const Gremlin = require('gremlin');
const config = require("./config");
const dbconst = require('./dbconst');
const authenticator = new Gremlin.driver.auth.PlainTextSaslAuthenticator(`/dbs/${config.database}/colls/${config.collection}`, config.primaryKey);


/**
 * Create client object.
 */
const client = new Gremlin.driver.Client(
	config.endpoint, {
	authenticator,
	traversalsource: "g",
	rejectUnauthorized: true,
	mimeType: "application/vnd.gremlin-v2.0+json"
}
);

module.exports = {
	client: client,
	addNode: addNode,
	dropNodeByID: dropNodeByID,
	addEdge: addEdge,
	checkEdge: checkEdge,
	dropEdge: dropEdge,
	editProperty: editProperty,
	findNodeByID: findNodeByID,
	findChildrenByID: findChildrenByID,
	findNodeByCustomQuery: findNodeByCustomQuery,
	findNodeByIDVersion: findNodeByIDVersion
};


/** addNode is a generic method to create a node in the database. 
 * In case of PO creation the query string will contain details of the PO. For other component types it is not needed.
 * 
 * @param  String label
 * @param  JSON attrib
 * @param  String queryString=null
 * 
 * @returns promise[JSON result]
 */
function addNode(label, attrib, queryString = null) {
	//console.log(attrib);
	//console.log(!query_string);
	return new Promise((resolve, reject) => {
		let finalQueryString = "";
		if (!queryString) {
			const objKeys = Object.keys(attrib);
			let createQuery = "g.addV('" + label + "').property('pk','" + label + "')";
			for (let j = 0; j < objKeys.length; j++) {
				if (objKeys[j].endsWith("_dt") || objKeys[j].endsWith("_ver") || objKeys[j].endsWith("_value") || objKeys[j].startsWith("credit") || objKeys[j].endsWith("_amount") || objKeys[j].includes("amount")) {
					createQuery = createQuery + ".property('" + objKeys[j] + "'," + attrib[objKeys[j]] + ")";
				} else {
					createQuery = createQuery + ".property('" + objKeys[j] + "','" + attrib[objKeys[j]] + "')";
				}
			}
			finalQueryString = createQuery;
		} else {
			finalQueryString = queryString;
		}
		//console.log(finalQueryString);
		client.submit(finalQueryString, {})
			.then(function (addResult) {
				console.log("Node created successfully");
				resolve(addResult);
			})
			.catch((err) => {
				console.log("**Node creation failed** ", err);
				reject(err);
			})
	});
}


/**
 * To drop the entire database this method can be used.
 * THIS SHOULD ONLY BE USED IN DEV ONLY.
 * 
 * THIS SHOULD BE A PRIVATE METHOD
 * 
 * @returns promise[JSON result]
 */
/*function dropDB() {
	return new Promise((resolve, reject) => {
		console.log("drop all");
		client.submit('g.V().drop()', {})
			.then(function (dropResult) { console.log("Database dropped!!"); resolve(dropResult); })
			.catch((err) => { console.log("Drop database failed", err); reject(err); })
	});
	console.log('drop complete');
}*/


/**
 * To drop a node this method is used.
 * This drops only a single node. 
 * 
 * @param  String label
 * @param  String nodeId
 * 
 * @returns promise[JSON result]
 */
function dropNodeByID(label, nodeId) {
	return new Promise((resolve, reject) => {
		console.log("Deleting %s with ID %s", label, nodeId);
		client.submit("g.V().hasLabel('label','" + label + "').has('id', '" + nodeId + "').drop()")
			.then(function (dropResult) {
				console.log("%s removed successfully", nodeId);
				resolve(dropResult);
			})
			.catch((err) => {
				console.log("**Delete opeartion failed** ", err);
				reject(err);
			})
	});
	console.log('drop complete');
}


/**
 * To add a link betweek two nodes addEdge is used.
 * Only two nodes can be connected at a time.
 * 
 * @param String source 
 * @param String dest 
 * @param String rel 
 * 
 * @returns promise[JSON result]
 */
function addEdge(source, dest, rel) {
	return new Promise((resolve, reject) => {
		console.log('Add relation between', source, dest, rel);
		client.submit("g.V(source).addE(relationship).to(g.V(target))", {
			source: source,
			relationship: rel,
			target: dest
		})
			.then(function (addEdgeResult) {
				console.log("Edge added successfully");
				resolve(addEdgeResult);
			})
			.catch((err) => {
				console.log("**Could not link nodes**", err);
				reject(err);
			})
	})
}


/**
 * To check the edge between two nodes.
 *
 *
 * @param String source
 * @param String dest
 *
 * @returns promise[JSON result]
 */
function checkEdge(source, dest, rel) {
	console.log('CHECK EDGE SOURCE::', source, 'TARGET ::', dest, rel);
	return new Promise((resolve, reject) => {
		client.submit("g.V(source).outE(relationship).where(otherV().is(target))", {
			source: source,
			relationship: rel,
			target: dest
		})
			.then(function (checkEdgeResult) {
				console.log("Edge check Result", checkEdgeResult);
				resolve(checkEdgeResult);
			})
			.catch((err) => {
				console.log("**Could not check edge**", err);
				reject(err);
			})
	})
}

/**
 * To drop the eedge between two nodes dropEdge is used.
 *
 *
 * @param String source
 * @param String dest
 *
 * @returns promise[JSON result]
 */
function dropEdge(source, dest) {
	return new Promise((resolve, reject) => {
		console.log('Drop relation between', source, dest);
		client.submit("g.V(source).bothE().where(otherV().is(target)).drop()", {
			source: source,
			target: dest
		})
			.then(function (addEdgeResult) {
				console.log("Edge dropped successfully");
				resolve(addEdgeResult);
			})
			.catch((err) => {
				console.log("**Could not drop edge**", err);
				reject(err);
			})
	})
}




/**
 * Finds a node by label and ID of the node.
 * Returns search result only for the node and not the child nodes.
 * 
 * @param String label 
 * @param String nodeId 
 * 
 * @returns promise[JSON result]
 */
function findNodeByID(label, nodeId) {
	return new Promise((resolve, reject) => {
		console.log('Find node =', nodeId, label);
		client.submit("g.V().hasLabel('label', label).has('id',id)", {
			label: label,
			id: nodeId
		})
			.then(function (findResult) {
				console.log("Node found!! %s", nodeId);
				resolve(findResult);
			})
			.catch((err) => {
				console.log("%s not found!", nodeId);
				reject(err);
			})
	})
}

/**
 * Finds a node by label and ID of the node.
 * Returns search result only for the node and not the child nodes.
 * 
 * @param String label 
 * @param String nodeId 
 * 
 * @returns promise[JSON result]
 */
function findNodeByIDVersion(label, nodeId, version) {
	return new Promise((resolve, reject) => {
		console.log('Find node =', nodeId, label, version);
		client.submit("g.V().hasLabel('label', '" + label + "').has('id','" + nodeId + "').outE('" + dbconst.HAS_VERSION + "').inV().has('po_ver'," + version + ")", {
			label: label,
			id: nodeId
		})
			.then(function (findResult) {
				console.log("Node found!! %s", nodeId);
				resolve(findResult);
			})
			.catch((err) => {
				console.log("%s not found!", nodeId);
				reject(err);
			})
	})
}


/**
 * Executes a query passed to the method.
 * Returns search result .
 * 
 * @param String label 
 * @param String nodeId 
 * 
 * @returns promise[JSON result]
 */
function findNodeByCustomQuery(query) {
	return new Promise((resolve, reject) => {
		//console.log('Executing query', query);
		client.submit(query, {})
			.then(function (findResult) {
				console.log("Query executed");
				resolve(findResult);
			})
			.catch((err) => {
				console.log("Find query failed");
				reject(err);
			})
	})
}

/**
 * Update a property based on the id of the node.
 *  * 
 * @param String id 
 * @param JSON attrib 
 * 
 * @returns promise[JSON result]
 */
function editProperty(id, attrib) {
	return new Promise((resolve, reject) => {
		console.log('Edit node ', id);
		console.log('Attrib for Edit   ', attrib);
		//Check if PO object. Then update id with version num
		if (typeof attrib.po_desc !== 'undefined') {
			id = id + "_" + attrib.po_ver;
		}
		let final_edit_string = "";
		const obj_keys = Object.keys(attrib);
		let edit_query = "g.V('" + id + "')";
		obj_keys.forEach(elem => {
			if (elem != 'id') {
				if (elem.endsWith("_dt") || elem.endsWith("_ver") || elem.endsWith("_value") || elem.startsWith("credit") || elem.startsWith("credit") || elem.endsWith("_amount") || elem.includes("amount")) {

					edit_query = edit_query + ".property('" + elem + "'," + attrib[elem] + ")";
				} else {

					edit_query = edit_query + ".property('" + elem + "','" + attrib[elem] + "')";
				}

			}

		})

		final_edit_string = edit_query;
		//console.log(final_edit_string);
		client.submit(final_edit_string, {})
			.then(function (editResult) {
				console.log("%s updated successfully", id);
				resolve(editResult);
			})
			.catch((err) => {
				console.log("Update failed for ID: ", id, err);
				reject(err);
			})
	})
}


/**
 * Finds list of all child nodes by the parent node id.
 * Returns list of IDs of the children.
 * 
 * @param String nodeId 
 * 
 * @returns promise[JSON result]
 */
function findChildrenByID(nodeId) {
	return new Promise((resolve, reject) => {
		console.log('Find children of ', nodeId);
		client.submit("g.V(id).outE().inV()", {
			id: nodeId
		})
			.then(function (findResult) {
				console.log("Node found!! %s", nodeId);
				resolve(findResult);
			})
			.catch((err) => {
				console.log("%s not found!", nodeId);
				reject(err);
			})
	})
}
