"use strict";

const {
	addNode,
	dropNodeByID,
	addEdge,
	checkEdge,
	dropEdge,
	editProperty,
	findNodeByID,
	findChildrenByID,
	findNodeByIDVersion,
	findNodeByCustomQuery
} = require('./cosmosDB');
const dbconst = require('./dbconst');
const appconst = require('../appconst');



module.exports = {
	addSP: addSP,
	createSP: createSP,
	updateSP: updateSP,
	addPO: addPO,
	linkPoToContract: linkPoToContract,
	addInvoice: addInvoice,
	addSupportingDoc: addSupportingDoc,
	editProperties: editProperties,
	rollback: rollback,
	deleteNodeByID: deleteNodeByID,
	findNode: findNode,
	checkRelationshipStatus: checkRelationshipStatus,
	findNodeByIDAndVersion: findNodeByIDAndVersion,
	findPOByRequestorAndDateRange: findPOByRequestorAndDateRange,
	findPOByDeptSpTypeSpValueAndDateRange: findPOByDeptSpTypeSpValueAndDateRange,
	findPOByDeptContractStatusAndDateRange: findPOByDeptContractStatusAndDateRange,
	findPOBySupplierIdAndDateRange: findPOBySupplierIdAndDateRange,
	findAllVersionPoById: findAllVersionPoById,
	findContractByDept: findContractByDept,
	findSupplierByDept: findSupplierByDept,
	findPoBySupplierId: findPoBySupplierId,
	findSupplierByProgramId: findSupplierByProgramId,
	findInvoiceIdForSupportingDoc: findInvoiceIdForSupportingDoc,
	findNoOfUnverifiedDocForInvoice: findNoOfUnverifiedDocForInvoice,
	findInvoiceByDeptSupplierAndDateRange: findInvoiceByDeptSupplierAndDateRange,
	findInvoiceBySupplierAndDateRange: findInvoiceBySupplierAndDateRange,
	findAllInvoiceByDeptAndDateRange: findAllInvoiceByDeptAndDateRange,
	findAllInvoiceByContractAndDateRange: findAllInvoiceByContractAndDateRange,
	findInvoiceByPOIDandVersion: findInvoiceByPOIDandVersion,
	findInvoiceByPOIdVersionandDateRange: findInvoiceByPOIdVersionandDateRange,
	findInvoiceByPOIdVersionandDateRangeForSp: findInvoiceByPOIdVersionandDateRangeForSp,
	findAllDocByInvoiceID: findAllDocByInvoiceID,
	findAllSPByDeptAndDateRange: findAllSPByDeptAndDateRange,
	findPObyDeptDateandContract: findPObyDeptDateandContract,
	addSummarySheetInformation: addSummarySheetInformation,
	viewSummarySheetBySupplier: viewSummarySheetBySupplier,
	viewSummarySheetByDept: viewSummarySheetByDept
}

/**
 * This method creates a PO node with a version node. In case the PO node is existing, it will create only a version node.
 * At the end of creating the nodes, both will be linked.
 *
 * @param JSON attrib
 *
 * @returns JSON {msg, resoponse code}
 */
async function addPO(attrib) {

	console.log("Adding a PO");
	let sams_id = attrib.sams_id;
	let po_id = attrib.id;
	let supplier_id = attrib.supplier_id;
	let contract_id = attrib.contract_id;
	let query_string = "g.addV('" + dbconst.PO + "').property('pk','" + dbconst.PO + "').property('id','" + po_id + "')";
	let findResponse = await findNodeByID(dbconst.PO, po_id);
	console.log("Parent PO %s found ", po_id);
	if (findResponse.length == 0) {
		let po_response = await addNode(dbconst.PO, null, query_string);
		if (po_response.err) {
			console.log(po_response.err);
			throwCustomError(po_response.err, po_response.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
		}
		//Join SAMS ID
		let po_edgeResponse = await addEdge(po_id, sams_id, dbconst.HAS);
		if (po_edgeResponse.err) {
			console.log(po_edgeResponse.err);
			throwCustomError(po_edgeResponse.err, po_edgeResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
		} else {
			console.log("SMAS ID attached to PO successfully");
		}
		//Join supplier with PO
		if (supplier_id) {
			po_edgeResponse = await addEdge(po_id, supplier_id, dbconst.HAS);
			if (po_edgeResponse.err) {
				console.log(po_edgeResponse.err);
				throwCustomError(po_edgeResponse.err, po_edgeResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
			} else {
				console.log("Supplier attached to PO successfully");
			}
		}
		//Join Program with PO
		if (contract_id) {
			po_edgeResponse = await addEdge(contract_id, po_id, dbconst.CONTAINS);
			if (po_edgeResponse.err) {
				console.log(po_edgeResponse.err);
				throwCustomError(po_edgeResponse.err, po_edgeResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
			} else {
				console.log("Program attached to PO successfully");
			}
		}
	}

	//There is no error while creating the PO or the PO master already exists. Create the version attribute.
	for (let i = 0; i < attrib.versions.length; i++) {
		let versionData = attrib.versions[i];
		const versionId = po_id + dbconst.DELIM + parseInt(versionData[dbconst.PO_VER]);
		versionData["id"] = versionId;
		findResponse = await findNodeByID(dbconst.PO_VER, versionId);
		let addNodeResponse = ""
		if (findResponse.length == 0) {
			addNodeResponse = await addNode(dbconst.PO_VER, versionData);
			if (addNodeResponse.err) {
				console.log(addNodeResponse.err);
				throwCustomError(addNodeResponse.err, addNodeResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
			} else {
				let edgeResponse = await addEdge(po_id, versionId, dbconst.HAS_VERSION);
				if (edgeResponse.err) {
					console.log(edgeResponse.err);
					throwCustomError(edgeResponse.err, edgeResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
				} else {
					console.log("po version attached to PO successfully");
				}
			}
		} else {
			console.log('PO version already exists. Nothing to do.');
		}
	}

	return {
		msg: "PO version successfully created and linked",
		code: appconst.HTTP_STATUS_OK
	};
}

/**
 * An invoice will be added to a version of an existing PO.
 * If the PO does not exists, it will return an error.
 *
 * @param  String poId
 * @param  String poVersion
 * @param  JSON attrib
 *
 * @returns JSON {msg, resoponse_code}
 */
async function addInvoice(poId, poVersion, attrib) {
	const invoiceId = attrib.id;
	console.log("Adding an Invoice");
	let po_id = poId + dbconst.DELIM + poVersion;
	let inv_response = "";
	let findPOResponse = await findNodeByID(dbconst.PO_VER, po_id);
	if (findPOResponse.length == 0) {
		return {
			msg: "PO does not exist",
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
	let findInvoiceResponse = await findNodeByID(dbconst.INVOICE, invoiceId);
	if (findPOResponse.length > 0 && findInvoiceResponse.length == 0) {
		//Include PO# and version for download path construction
		attrib.po_ver = poVersion;
		attrib.po_num = poId;
		inv_response = await addNode(dbconst.INVOICE, attrib, null);
		if (inv_response.err) {
			console.log(inv_response.err);
			throwCustomError(inv_response.err, inv_response.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
		} else {
			let edgeResponse = await addEdge(po_id, invoiceId, dbconst.HAS_INVOICE);
			if (edgeResponse.err) {
				console.log(edgeResponse.err);
				throwCustomError(inv_response.err, inv_response.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
			} else {
				console.log("Invoice succesfully created and linked to PO");
				return {
					msg: "Invoice successfully created and linked",
					code: appconst.HTTP_STATUS_OK
				};
			}
		}
	} else {
		console.log("Invoice already exists Link with PO ");
		let checkRelationStatus = await checkRelationshipStatus(po_id, invoiceId, dbconst.HAS_INVOICE);
		console.log("check edge relationship status ", checkRelationStatus);
		if (checkRelationStatus.msg === true) {
			return {
				msg: "Relationship already exist",
				code: appconst.HTTP_STATUS_OK
			};
		}
		let edgeResponse = await addEdge(po_id, invoiceId, dbconst.HAS_INVOICE);
		if (edgeResponse.err) {
			console.log(edgeResponse.err);
			throwCustomError(inv_response.err, inv_response.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
		} else {
			console.log("Invoice successfully linked to PO");
			return {
				msg: "Invoice successfully linked",
				code: appconst.HTTP_STATUS_OK
			};
		}
	}
	return;
}

/**
 * This will add supporting document to an invoice.
 * Invoice has to exists for creating a document.
 *
 * @param String invoiceId
 * @param JSON attrib
 *
 * @returns JSON {msg, resoponse_code}
 */
async function addSupportingDoc(invoiceId, attrib) {
	console.log("Adding a supporting document: ", invoiceId, attrib.id);
	let doc_response = "";
	let findInvResponse = await findNodeByID(dbconst.INVOICE, invoiceId);
	if (findInvResponse.err) {
		console.log("Error while looking for invoice", invoiceId, findInvResponse.err);
		throwCustomError(findInvResponse.err, findInvResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
	}
	if (findInvResponse.length == 0) {
		throwCustomError("Invoice not found", "Invoice not found", appconst.HTTP_STATUS_NOT_MODIFIED)
	}
	let findDocResponse = await findNodeByID(dbconst.SUPPORTING_DOC, attrib.id);

	if (findDocResponse.length == 0) {
		doc_response = await addNode(dbconst.SUPPORTING_DOC, attrib, null);
		if (doc_response.err) {
			console.log(doc_response.err);
			throwCustomError(doc_response.err, doc_response.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
		} else {
			console.log(" adding edge between just created SD and invoice:::", invoiceId, attrib.id, dbconst.HAS_DOC);
			let edgeResponse = await addEdge(invoiceId, attrib.id, dbconst.HAS_DOC);
			if (edgeResponse.err) {
				console.log(edgeResponse.err);
			} else {
				console.log("Supporting document successfully attached to invoice");
				return {
					msg: "Supporting document successfully created",
					code: appconst.HTTP_STATUS_OK
				};
			}
		}
	} else {
		console.log("Doc is already exists Link with Invoice ");
		let checkRelationStatus = await checkRelationshipStatus(invoiceId, attrib.id, dbconst.HAS_INVOICE);
		console.log("check edge relationship status ", checkRelationStatus);
		if (checkRelationStatus.msg === true) {
			return {
				msg: "Relationship already exist",
				code: appconst.HTTP_STATUS_OK
			};
		}
		console.log(" adding edge between existing SD and invoice:::", invoiceId, attrib.id, dbconst.HAS_DOC);
		// TFS-3946438 updated edge label from "has_invoice" to "has_doc"
		let edgeResponse = await addEdge(invoiceId, attrib.id, dbconst.HAS_DOC);
		if (edgeResponse.err) {
			console.log(edgeResponse.err);
			throwCustomError(inv_response.err, inv_response.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
		} else {
			console.log("Invoice successfully linked to Doc");
			return {
				msg: "Invoice successfully linked to Doc",
				code: appconst.HTTP_STATUS_OK
			};
		}
	}
	return;
}


/**
 * Update values of an existing property.
 *
 * @param String elementType
 * @param String artifactID
 * @param JSON attrib
 *
 * @returns JSON {msg, resoponse_code}
 */
async function editProperties(elementType, artifactID, attrib) {
	console.log("Editing propertis of:", elementType, "->", artifactID);
	let editResponse = "";
	if (elementType == dbconst.PO_VER) {
		artifactID = artifactID + dbconst.DELIM + attrib.po_ver;
	}
	let findResponse = await findNodeByID(elementType, artifactID);
	if (findResponse.length > 0) {
		editResponse = await editProperty(artifactID, attrib);
		if (editResponse.err) {
			console.log(editResponse.err);
			throwCustomError(editResponse.err, editResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
		} else {
			// let jsonVal = JSON.parse(JSON.stringify(editResponse));
			// console.log(jsonVal._items);
			console.log('Edit property successful');
			return {
				msg: "Property edited successfully for ID %s",
				artifactID,
				code: appconst.HTTP_STATUS_OK
			};
		}
	} else {
		console.log("No element exists to update");
		return {
			msg: "No element exists to update",
			code: appconst.HTTP_STATUS_OK
		};
	}
}


/**
 * Find an element by its ID
 *
 * @param String label
 * @param String nodeId
 *
 * @returns JSON {msg, resoponse_code}
 */
async function findNode(label, nodeId) {
	console.log("Finding node by ID", label, nodeId);
	let findPOResponse = await findNodeByID(label, nodeId);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse)))._items[0],
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: "No element is found in the Database",
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 * Find an element by its ID and version. Mostly needed for PO
 *
 * @param String label
 * @param String nodeId
 *
 * @returns JSON {msg, resoponse_code}
 */
async function findNodeByIDAndVersion(label, nodeId, version) {
	console.log("Finding node by ID and version", label, nodeId, version);
	let findPOResponse = await findNodeByIDVersion(label, nodeId, version);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse)))._items[0],
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: "No element is found in the Database",
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 * Rollback last operation and its sub modules by ID.
 * It is assumed that during a failure only an immidiate level under the affected node may get created.
 * Therefore, to prevent orphan entity creation, rollback immediate children as well.
 * This will not affect any existing node since it will only be invoked at the time of creation. Specifically PO.
 *
 * @param String elementType
 * @param String artifactID
 *
 * @returns JSON {msg, resoponse_code}
 */
async function rollback(elementType, artifactID) {
	console.log("Rolling back propertis of:", elementType, "->", artifactID);
	let dropResponse = "";
	let findResponse = await findNodeByID(elementType, artifactID);

	if (findResponse.length > 0) {
		let findChildrenResponse = await findChildrenByID(artifactID);
		let childrenList = JSON.parse(JSON.stringify(findChildrenResponse))._items;
		console.log("%s children found", childrenList.length);

		for (const childElement of childrenList) {
			let dropChildResponse = await dropNodeByID(childElement.label, childElement.id);
			console.log(dropChildResponse);
			if (dropChildResponse.err) {
				console.log("Rollback of ", element.id, "failed with error: ", dropChildResponse.err);
				throwCustomError(dropResponse.err, dropResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
			}
		}
		dropResponse = await dropNodeByID(elementType, artifactID);
		if (dropResponse.err) {
			console.log("Rollback of ", artifactID, "failed with error: ", dropResponse.err);
			throwCustomError(dropResponse.err, dropResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
		} else {
			console.log("Rollback of ", artifactID, "is successful");
			return {
				msg: "Rollback completed successfully",
				code: appconst.HTTP_STATUS_OK
			};
		}
	} else {
		console.log("No element exists to rollback");
		return {
			msg: "No element exists to rollback",
			code: appconst.HTTP_STATUS_OK
		};
	}
}

/**
 * Creates an error object and throws to the caller
 *
 * @param JSON errObj
 * @param String msg
 * @param Number errorCode
 */
function throwCustomError(errObj, msg, errorCode) {
	const err = new Error(errObj.err);
	err.message = msg;
	err.code = appconst.HTTP_STATUS_NOT_MODIFIED;
	throw err;
}


/**
 * delete node by ID
 *
 * @param String ID
 *
 * @returns JSON {msg, resoponse_code}
 */

async function deleteNodeByID(label, nodeId) {
	// Check if the node is exist in the database
	let findNodeResponse = await findNodeByID(label, nodeId);
	if (findNodeResponse.err) {
		console.log("Find node error ", nodeId, "failed with error: ", findNodeResponse.err);
		throwCustomError(findNodeResponse.err, findNodeResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
	}
	//If node is exist then delete the node
	if (findNodeResponse.length > 0) {
		let dropResponse = await dropNodeByID(label, nodeId);
		if (dropResponse.err) {
			console.log("Deletion of node error ", nodeId, "failed with error: ", dropResponse.err);
			throwCustomError(dropResponse.err, dropResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
		} else {
			console.log("deletion of node ", nodeId, "is successful");
			return {
				msg: "Delete completed successfully",
				code: appconst.HTTP_STATUS_OK
			};
		}

	} else {
		return {
			msg: "No element is found in the database to delete",
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}

}


/**
 * Find supplier list by department ID
 *
 * @param String departmentID
 *
 * @returns JSON {msg, resoponse_code}
 */
async function findSupplierByDept(departmentID) {
	console.log("Finding supplier by department", departmentID);
	let query = "g.V().hasLabel('" + dbconst.DEPT + "').has('id','" + departmentID + "').outE().inV().hasLabel('" + dbconst.SUPPLIER + "').dedup()";
	console.log(" QUERY IS :: ", query);
	let findPOResponse = await findNodeByCustomQuery(query);
	let supplierList = [];
	try {
		if (findPOResponse.length > 0) {
			let ret_val = JSON.parse(JSON.stringify(findPOResponse))._items;
			for (let elem in ret_val) {
				let data = {
					"id": ret_val[elem].id,
					"sup_name": typeof ret_val[elem].properties.supplier_name === 'undefined' ? " " : ret_val[elem].properties.supplier_name[0].value
				};
				supplierList.push(data);
			}
			return ({
				msg: {
					'supplierList': supplierList
				},
				code: appconst.HTTP_STATUS_OK
			});
		}
	} catch (err) {
		console.log(err);
		throwCustomError(err, err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
	}
	return ({
		msg: {
			'supplierList': supplierList
		},
		code: appconst.HTTP_STATUS_OK
	});
}

/**
 * Find supplier list by programe ID
 *
 * @param String programe ID
 *
 * @returns JSON {msg, resoponse_code}
 */

async function findSupplierByProgramId(program_id) {
	console.log("Finding supplier by department", program_id);
	let query = "g.V('" + program_id + "').outE().hasLabel('run_by').inV().dedup()";

	let findPOResponse = await findNodeByCustomQuery(query);
	let supplierList = [];
	try {
		if (findPOResponse.length > 0) {
			let ret_val = JSON.parse(JSON.stringify(findPOResponse))._items;
			console.log("response from DB ", ret_val)
			for (let elem in ret_val) {
				let data = {
					"id": ret_val[elem].id,
					"sup_name": typeof ret_val[elem].properties.supplier_name === 'undefined' ? " " : ret_val[elem].properties.supplier_name[0].value
				};
				supplierList.push(data);
			}
		}
	} catch (err) {
		console.log(err);
		throwCustomError(err, err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
	}

	return ({
		msg: {
			'supplierList': supplierList
		},
		code: appconst.HTTP_STATUS_OK
	});

}


/**
 * Find program list by department ID
 *
 * @param String departmentID
 *
 * @returns JSON {msg, resoponse_code}
 */
async function findContractByDept(departmentID) {
	console.log("Finding contracts by department", departmentID);
	let query = "g.V().hasLabel('" + dbconst.DEPT + "').has('id','" + departmentID + "').outE().inV().hasLabel('" + dbconst.PROGRAM + "').dedup()";
	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}

/**
 * Find all PO versions by PO ID
 *
 * @param String po_id
 *
 * @returns JSON {msg, resoponse_code}
 */
async function findAllVersionPoById(po_id) {
	console.log("Finding all versions for PO ID", po_id);
	let query = "g.V().hasLabel('" + dbconst.PO + "').has('id','" + po_id + "').outE('" + dbconst.HAS_VERSION + "').inV().order().by('created_dt',decr)";
	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		let parsedPOResponse = (JSON.parse(JSON.stringify(findPOResponse)))._items[0];
		let po_id = parsedPOResponse.id.substr(0, parsedPOResponse.id.lastIndexOf('_'))

		//Query to fetch sams_id information for PO
		let get_sams_id_query = "g.V().hasLabel('" + dbconst.PO + "').has('id','" + po_id + "').outE('" + dbconst.HAS + "').inV().id()"
		let sams_id_query_response = await findNodeByCustomQuery(get_sams_id_query);

		if (sams_id_query_response.length > 0) {
			parsedPOResponse.sams_id = sams_id_query_response._items[0]
		}
		else {
			parsedPOResponse.sams_id = ""
		}

		return {
			msg: parsedPOResponse,
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: "No element is found in the Database",
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}

/**
 * Find all Invoice by PO_Id , Po_ver
 *
 * @param String po_id
 * @param Number po_ver
 *
 * @returns JSON {msg, resoponse_code}
 */

async function findInvoiceByPOIDandVersion(po_id, po_ver) {
	console.log("Finding all invoices for PO version ", po_id);
	let query = "g.V().hasLabel('" + dbconst.PO + "').has('id','" + po_id + "').outE('" + dbconst.HAS_VERSION + "').inV().has('po_ver',P.gte(" + po_ver + ")).outE('" + dbconst.HAS_INVOICE + "').inV()";

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 * Find Invoice Id for a Document by Id
 * 
 * @param String doc_id
 *
 * @returns JSON {msg, resoponse_code}
 */

async function findInvoiceIdForSupportingDoc(doc_id) {
	console.log("Finding Invoice Id by Doc Id ", doc_id);
	let query = "g.V().hasLabel('" + dbconst.SUPPORTING_DOC + "').has('id','" + doc_id + "').inE('" + dbconst.HAS_DOC + "').outV().id()";

	console.log('query is ', query);

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}

/**
 * Find doc verification status for invoice by Id
 * 
 * @param String invoice_id
 *
 * @returns JSON {msg, resoponse_code}
 */

async function findNoOfUnverifiedDocForInvoice(invoice_id) {
	console.log("Finding doc verification status for invoices ", invoice_id);
	let query = "g.V().hasLabel('" + dbconst.INVOICE + "').has('id','" + invoice_id + "').outE('" + dbconst.HAS_DOC + "').inV().has('doc_verification_status','false').count()";

	console.log('query is ', query);

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 * Find all Invoice by Department,Supplier Id and Date Range
 * @param String dept_id
 * @param String supplier_id
 * @param Number start_date
 * @param Number end_date
 *
 * @returns JSON {msg, resoponse_code}
 */

async function findInvoiceByDeptSupplierAndDateRange(dept_id, supplier_id, start_dt, end_dt) {
	console.log("Finding all invoices by department, supplier and Date Range ", dept_id, supplier_id, start_dt, end_dt);
	let query = "g.V().hasLabel('" + dbconst.PO_VER + "').has('current_dept_id','" + dept_id + "').outE('" + dbconst.HAS_INVOICE + "').inV().has('supplier_id','" + supplier_id + "').has('invoice_dt',P.gte(" + start_dt + ")).has('invoice_dt',P.lte(" + end_dt + "))";

	console.log("QUERY IS ", query);

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 * Find all Invoice by Supplier Id and Date Range
 * @param String supplier_id
 * @param Number start_date
 * @param Number end_date
 *
 * @returns JSON {msg, resoponse_code}
 */

async function findInvoiceBySupplierAndDateRange(supplier_id, start_dt, end_dt) {
	console.log("Finding all invoices by supplier and Date Range ", supplier_id, start_dt, end_dt);
	let query = "g.V().hasLabel('" + dbconst.INVOICE + "').has('supplier_id','" + supplier_id + "').has('invoice_dt',P.gte(" + start_dt + ")).has('invoice_dt',P.lte(" + end_dt + "))";

	console.log("QUERY IS ", query);

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 * Find all Invoice by Department and Date Range
 *
 * @param String dept_id
 * @param Number start_date
 * @param Number end_date
 *
 * @returns JSON {msg, resoponse_code}
 */
async function findAllInvoiceByDeptAndDateRange(dept_id, start_dt, end_dt) {
	console.log("Finding all invoices by department and Date Range ", dept_id, start_dt, end_dt);
	let query = "g.V().hasLabel('po_ver').has('current_dept_id','" + dept_id + "').outE('" + dbconst.HAS_INVOICE + "').inV().has('invoice_dt',P.gte(" + start_dt + ")).has('invoice_dt',P.lte(" + end_dt + "))";

	console.log("QUERY IS ", query);

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 * Find all Invoice by Contract and Date Range
 *
 * @param String contract_id
 * @param Number start_date
 * @param Number end_date
 *
 * @returns JSON {msg, resoponse_code}
 */
async function findAllInvoiceByContractAndDateRange(contract_id, start_dt, end_dt) {
	console.log("Finding all invoices by Contract and Date Range ", contract_id, start_dt, end_dt);

	let query = "g.V().hasLabel('" + dbconst.PROGRAM + "').has('id','" + contract_id + "').outE('contains').inV().outE('has_version').inV().outE('has_invoice').inV().has('invoice_dt',P.gte(" + start_dt + ")).has('invoice_dt',P.lte(" + end_dt + "))";
	console.log("QUERY IS ", query);

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 * Find all PO by supplier Id
 *
 * @param String supplier id
 *  *
 * @returns JSON {msg, resoponse_code}
 */
async function findPoBySupplierId(supplierid) {
	console.log("Finding all  PO by supplier Id ", supplierid);
	let query = "g.V().hasLabel('" + dbconst.PO_VER + "').has('supplier_id', '" + supplierid + "')";

	console.log("QUERY IS ", query);

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}



/**
 * Find all Invoice by PO_Id , Po_ver and Date Range
 *
 * @param String po_id
 * @param Number po_ver
 * @param Number start_date
 * @param Number end_date
 *
 * @returns JSON {msg, resoponse_code}
 */
async function findInvoiceByPOIdVersionandDateRange(po_id, po_ver, start_dt, end_dt) {
	console.log("Finding all invoices for PO version and Date Range ", po_id, po_ver);
	let query = "g.V().hasLabel('" + dbconst.PO + "').has('id','" + po_id + "').outE('" + dbconst.HAS_VERSION + "').inV().has('po_ver',P.eq(" + po_ver + ")).outE('" + dbconst.HAS_INVOICE + "').inV().has('invoice_dt',P.gte(" + start_dt + ")).has('invoice_dt',P.lte(" + end_dt + "))";

	console.log("QUERY IS ", query);

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 * Find all Invoice by PO_Id , Po_ver and Date Range for Submission package
 *
 * @param String po_id
 * @param Number po_ver
 * @param Number start_date
 * @param Number end_date
 *
 * @returns JSON {msg, resoponse_code}
 */
async function findInvoiceByPOIdVersionandDateRangeForSp(po_id, po_ver, start_dt, end_dt) {
	console.log("Finding all invoices for PO version and Date Range for SP ", po_id, po_ver);

	let query = "g.V().hasLabel('" + dbconst.PO + "').has('id','" + po_id + "').outE('" + dbconst.HAS_VERSION + "').inV().has('po_ver',P.eq(" + po_ver + ")).outE('" + dbconst.HAS_INVOICE + "').inV().not(outE('" + dbconst.HAS_SP + "')).has('invoice_dt',P.gte(" + start_dt + ")).has('invoice_dt',P.lte(" + end_dt + "))";

	console.log("for invoice QUERY IS ", query);

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 * Find all Document by invoice ID
 *
 * @param String invoice_id
 *
 * @returns JSON {msg, resoponse_code}
 */

async function findAllDocByInvoiceID(invoice_id) {
	//console.log("Finding all supporting docs by Invoice ID ", invoice_id);
	let query = "g.V().hasLabel('" + dbconst.INVOICE + "').has('id','" + invoice_id + "').outE('" + dbconst.HAS_DOC + "').inV()";
	console.log("findAllDocByInvoiceID query:", query);
	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}

/**
 * Find all Submission package by Department and date range
 *
 * @param String dept
 * @param Number start_date
 * @param Number end_date
 *
 * @returns JSON {msg, resoponse_code}
 */

async function findAllSPByDeptAndDateRange(dept_id, start_dt, end_dt) {

	console.log("Finding all Submission package by Date Range ", start_dt, end_dt);
	let query = "g.V().hasLabel('" + dbconst.SP + "').has('dept_id','" + dept_id + "').has('created_dt',P.gte(" + start_dt + ")).has('created_dt',P.lte(" + end_dt + ")).valueMap(true)";

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 * Find all PO versions by date range
 * @param String  supplier_id
 * @param Number start_date
 * @param Number end_date
 *
 * @returns JSON {msg, resoponse_code}
 */
async function findPOBySupplierIdAndDateRange(supplier_id, start_dt, end_dt) {
	console.log("Finding all versions for PO ", supplier_id);
	let query = "g.V().hasLabel('" + dbconst.PO + "').outE('" + dbconst.HAS_VERSION + "').inV().has('supplier_id','" + supplier_id + "').or(has('start_dt',P.lte(" + start_dt + ")).and(has('end_dt',P.gte(" + start_dt + "))),has('start_dt',P.lte(" + end_dt + ")).and(has('end_dt',P.gte(" + end_dt + "))),has('start_dt',P.gte(" + start_dt + ")).and(has('end_dt',P.lte(" + end_dt + ")))).order().by('" + dbconst.PO_VER + "',decr)";

	console.log("Query is ", query);
	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: "No element is found in the Database",
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}

}



/**
 * Find all PO versions by date range
 *
 * @param Number start_date
 * @param Number end_date
 *
 * @returns JSON {msg, resoponse_code}
 */
async function findPOByRequestorAndDateRange(department_id, start_dt, end_dt) {
	console.log("Finding all versions for PO ", department_id);
	let query = "g.V().hasLabel('" + dbconst.PO + "').outE('" + dbconst.HAS_VERSION + "').inV().has('current_dept_id','" + department_id + "').or(has('start_dt',P.lte(" + start_dt + ")).and(has('end_dt',P.gte(" + start_dt + "))),has('start_dt',P.lte(" + end_dt + ")).and(has('end_dt',P.gte(" + end_dt + "))),has('start_dt',P.gte(" + start_dt + ")).and(has('end_dt',P.lte(" + end_dt + ")))).order().by('" + dbconst.PO_VER + "',decr)";
	console.log("Query is ", query);
	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: "No element is found in the Database",
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}

}


/**
 * Find all PO versions by dept,targetSpType,targetSpValue and date range
 *
 * @param String department_id
 * @param String spType
 * @param String spValue
 * @param Number start_date
 * @param Number end_date
 *
 * @returns JSON {msg, resoponse_code}
 */

async function findPOByDeptSpTypeSpValueAndDateRange(department_id, spType, spValue, start_dt, end_dt) {
	console.log("Finding all versions for PO ", department_id, spType, spValue);
	let query;

	if (spType == "program_id") {
		query = "g.V().hasLabel('" + dbconst.PO + "').outE('" + dbconst.HAS_VERSION + "').inV().has('program_id','" + spValue + "').has('current_dept_id','" + department_id + "').or(has('start_dt', P.lte(" + start_dt + ")).and(has('end_dt', P.gte(" + start_dt + "))), has('start_dt', P.lte(" + end_dt + ")).and(has('end_dt', P.gte(" + end_dt + "))), has('start_dt', P.gte(" + start_dt + ")).and(has('end_dt', P.lte(" + end_dt + ")))).order().by('" + dbconst.PO_VER + "', decr)";

	} else if (spType == "supplier_id") {
		query = "g.V().hasLabel('" + dbconst.PO + "').outE('" + dbconst.HAS_VERSION + "').inV().has('supplier_id','" + spValue + "').has('current_dept_id','" + department_id + "').or(has('start_dt', P.lte(" + start_dt + ")).and(has('end_dt', P.gte(" + start_dt + "))), has('start_dt', P.lte(" + end_dt + ")).and(has('end_dt', P.gte(" + end_dt + "))), has('start_dt', P.gte(" + start_dt + ")).and(has('end_dt', P.lte(" + end_dt + ")))).order().by('" + dbconst.PO_VER + "', decr)";
	}

	console.log("select PO left query is ", query);

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: "No element is found in the Database",
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}

}


/**
 * Find all PO dept,contract,status and date range
 *
 * @param String department_id
 * @param String contract
 * @param String status
 * @param Number start_date
 * @param Number end_date
 *
 * @returns JSON {msg, resoponse_code}
 */

async function findPOByDeptContractStatusAndDateRange(department_id, contract, status, start_dt, end_dt) {
	console.log("Finding all PO by status ", department_id, contract, status);
	let query = "g.V().hasLabel('" + dbconst.PO_VER + "').has('current_dept_id','" + department_id + "').has('program_id','" + contract + "').has('po_status','" + status + "').or(has('start_dt', P.lte(" + start_dt + ")).and(has('end_dt', P.gte(" + start_dt + "))), has('start_dt', P.lte(" + end_dt + ")).and(has('end_dt', P.gte(" + end_dt + "))), has('start_dt', P.gte(" + start_dt + ")).and(has('end_dt', P.lte(" + end_dt + ")))).order().by('" + dbconst.PO_VER + "', decr)";

	console.log("select PO query : ", query);

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: "No element is found in the Database",
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}

}


/**
 * This method creates a submission package node .
 *
 * @param JSON attrib
 *
 * @returns JSON {msg, resoponse code}
 */
async function addSP(sp_id, attrib) {
	console.log('Adding submission package');

	//  let query_string = "g.addV('" + dbconst.SP + "').property('pk','" + dbconst.SP + "').property('id','" + sp_id + "')";

	let sp_response = await addNode(dbconst.SP, attrib, null);
	if (sp_response.err) {
		console.log(sp_response.err)
		throwCustomError(sp_response.err, sp_response.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
	} else {
		return {
			msg: "Submission Package saved successfully",
			code: appconst.HTTP_STATUS_OK
		}
	}

}

/**
 * This method Generate a submission package node .
 *
 * @param JSON attrib
 *
 * @returns JSON {msg, resoponse code}
 */
async function createSP(sp_id, attrib) {
	let sp_response = await addNode(dbconst.SP, attrib, null);
	if (sp_response.err) {
		console.log(sp_response.err)
		throwCustomError(sp_response.err, sp_response.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
	} else {
		console.log('INSIDE CREATE SP');
		await Promise.all(attrib.selectedItems.map(async (_element) => {
			//Below type checking is done in order to fix the issue that arises while creating SP with single item in the element object
			if (typeof _element === 'object') {
				_element = _element;
			} else {
				_element = JSON.parse(_element)
			}
			let po_id = _element.id + dbconst.DELIM + _element.po_ver;
			const _edges = await addEdge(po_id, sp_id, dbconst.HAS_SP)
			const result = await Promise.all(_element.invoices.map(async (_inv) => {
				const _invcs = await addEdge(_inv.id, sp_id, dbconst.HAS_SP)

			}));
			console.log('PRINITNNG RESULT', result);
		}));
		return {
			msg: "Submission Package saved successfully",
			code: appconst.HTTP_STATUS_OK
		}
	}
}


/**
 * Find all PO dept,contract and date range
 *
 * @param String department_id
 * @param String contract
 * @param Number start_date
 * @param Number end_date
 *
 * @returns JSON {msg, resoponse_code}
 */

async function findPObyDeptDateandContract(department_id, contract_id, start_dt, end_dt) {
	console.log("Finding all PO by contract %s and department %s", department_id, contract_id);

	let query = "g.V('" + contract_id + "').outE('" + dbconst.CONTAINS + "').inV().outE('" + dbconst.HAS_VERSION + "').inV().has('current_dept_id','" + department_id + "').or(has('start_dt',P.lte(" + start_dt + ")).and(has('end_dt',P.gte(" + start_dt + "))),has('start_dt',P.lte(" + end_dt + ")).and(has('end_dt',P.gte(" + end_dt + "))),has('start_dt',P.gte(" + start_dt + ")).and(has('end_dt',P.lte(" + end_dt + ")))).order().by('" + dbconst.PO_VER + "',decr)";
	console.log("findPObyDeptDateandContract query is ", query);

	let findPOResponse = await findNodeByCustomQuery(query);

	if (findPOResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findPOResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: "No element is found in the Database",
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}

}


/**
 * Check the relationship status
 *
 * @param String source
 * @param String destination
 * @param String relation
 *
 * @returns JSON {msg, resoponse_code}
 */

async function checkRelationshipStatus(source, destination, relation) {
	console.log("checking the relationship status ");
	let query = "g.V('" + source + "').choose(outE('" + relation + "').inV().has('id', '" + destination + "'), constant(true), constant(false))";
	console.log("query is : ", query);

	let queryResponse = await findNodeByCustomQuery(query);
	let findPOResponse = JSON.parse(JSON.stringify(queryResponse));

	if (findPOResponse._items[0] === true) {
		return {
			msg: true,
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: false,
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 * Link PO to Contract id
 *
 * @param String po_id
 * @param String contract_id
 *
 * @returns JSON {msg, resoponse_code}
 */

async function linkPoToContract(po_id, contract_id) {

	console.log('DBFACADE :: po_id::', po_id, 'contract_id', contract_id);
	// check if the po is linked to Unallocated Contract
	let edgeCheckResult = await checkEdge('oms_program_7', po_id, dbconst.CONTAINS);
	console.log('EDGECHECK RESULT ::', edgeCheckResult)
	if (edgeCheckResult.length != 0) {
		let dropEdgeResult = await dropEdge('oms_program_7', po_id);
		if (dropEdgeResult.err) {
			console.log(dropEdgeResult.err);
			throwCustomError(dropEdgeResult.err, dropEdgeResult.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
		} else {
			console.log("PO unlinked with unallocated contract successfully");
			let addEdgeResult = await addEdge(contract_id, po_id, dbconst.CONTAINS);
			if (addEdgeResult.err) {
				console.log(addEdgeResult.err);
				throwCustomError(addEdgeResult.err, addEdgeResult.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
			} else {
				console.log("ContractId attached to PO successfully");
				let _updateObj = {
					"program_id": contract_id,
					"po_ver": "1"
				};
				let updatePOObj = await editProperties(dbconst.PO_VER, po_id, _updateObj);

			}
			return {
				msg: "PO linked with the contract successfully",
				code: appconst.HTTP_STATUS_OK
			}

		}

	} else {
		let edgeCheckError = {
			"msg": "ONLY UNALLOCATED PO CAN BE ALLOCATED",
			"code": appconst.HTTP_STATUS_NOT_MODIFIED
		}
		throwCustomError(edgeCheckError, edgeCheckError.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
	}
}

/**
 ** This method creates a Summary Sheet node .
 ** @param JSON summarySheetInformation
 ** @returns JSON {msg, response code}
 **/
async function addSummarySheetInformation(summarySheetInformation) {
	console.log('Adding Summary Sheet as a Node');
	let summarySheet_response = await addNode(dbconst.SS, summarySheetInformation, null);

	if (summarySheet_response.err) {
		console.log(summarySheet_response.err)
		throwCustomError(summarySheet_response.err, summarySheet_response.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
	} else {
		let targetDeptId = summarySheetInformation.target_dept;
		let summarySheetId = summarySheetInformation.summarySheet_id;
		let supplier_id = summarySheetInformation.supplier_id;
		console.log("Summary sheet information inside DBFacade", JSON.stringify(summarySheetInformation));
		let addDeptIdEdgeResponse = await addEdge(targetDeptId, summarySheetId, dbconst.HAS_SS)   //Adding has_ss relationship between dept Id and Summary Sheet
		if (addDeptIdEdgeResponse.err) {
			console.log(addDeptIdEdgeResponse.err);
			throwCustomError(addDeptIdEdgeResponse.err, addDeptIdEdgeResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
		}
		else {
			let addSupplierEdgeResponse = await addEdge(supplier_id, summarySheetId, dbconst.HAS_SS) //Adding has_ss relationship between supplier ID and Summary Sheet
			if (addSupplierEdgeResponse.err) {
				console.log(addSupplierEdgeResponse.err);
				throwCustomError(addSupplierEdgeResponse.err, addSupplierEdgeResponse.err.msg, appconst.HTTP_STATUS_NOT_MODIFIED);
			}
			else {
				return {
					msg: "Summary Sheet Information saved successfully",
					code: appconst.HTTP_STATUS_OK
				}

			}
		}

	}

}

/**
 ** This method finds all Summary sheet based on Supplier ID.
 ** @param supplier_id
 ** @param start_dt
 ** @param end_dt
 ** @returns JSON {msg, response code}
 **/

async function viewSummarySheetBySupplier(supplier_id, start_dt, end_dt) {

	console.log("Finding all Summary Sheet based on Supplier ID ", start_dt, end_dt);
	let query = "g.V().hasLabel('" + dbconst.SS + "').has('supplier_id','" + supplier_id + "').has('created_dt',P.gte(" + start_dt + ")).has('created_dt',P.lte(" + end_dt + ")).valueMap(true)";

	let findSSResponse = await findNodeByCustomQuery(query);

	if (findSSResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findSSResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findSSResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}


/**
 ** This method finds all Summary sheet based on Department ID.
 ** @param dept_id
 ** @param start_dt
 ** @param end_dt
 ** @returns JSON {msg, response code}
 **/

async function viewSummarySheetByDept(dept_id, start_dt, end_dt) {

	console.log("Finding all Summary Sheet based on Department ID ", start_dt, end_dt);
	let query = "g.V().hasLabel('" + dbconst.SS + "').has('target_dept','" + dept_id + "').has('created_dt',P.gte(" + start_dt + ")).has('created_dt',P.lte(" + end_dt + ")).valueMap(true)";

	let findSSResponse = await findNodeByCustomQuery(query);

	if (findSSResponse.length > 0) {
		return {
			msg: (JSON.parse(JSON.stringify(findSSResponse))),
			code: appconst.HTTP_STATUS_OK
		};
	} else {
		return {
			msg: (JSON.parse(JSON.stringify(findSSResponse))),
			code: appconst.HTTP_STATUS_NOT_MODIFIED
		};
	}
}

async function updateSP(sp_id, sp_data, _createFlag = false) {
	console.log('Updating SP: INSIDE LIB')
	try {
		await editProperties(appconst.SP, sp_id, sp_data);
		if (_createFlag) {
			console.log('INSIDE CREATE FLAG')
			let result = await createSP(sp_id, sp_data, true)
		} else {
			let res = {
				msg: "Submission Package updated successfully",
				code: 200
			}
			return res
		}
	} catch (e) {
		console.log("ERROR ::", e)
	}
}