"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceLineRelations = exports.blueBookEntryRelations = void 0;
const drizzle_orm_1 = require("drizzle-orm");
const blue_book_entries_1 = require("./blue_book_entries");
const invoice_lines_1 = require("./invoice_lines");
const builders_1 = require("./builders");
const communities_1 = require("./communities");
const services_1 = require("./services");
exports.blueBookEntryRelations = (0, drizzle_orm_1.relations)(blue_book_entries_1.blueBookEntries, ({ one }) => ({
    builder: one(builders_1.builders, {
        fields: [blue_book_entries_1.blueBookEntries.builderId],
        references: [builders_1.builders.id],
    }),
    community: one(communities_1.communities, {
        fields: [blue_book_entries_1.blueBookEntries.communityId],
        references: [communities_1.communities.id],
    }),
    service: one(services_1.services, {
        fields: [blue_book_entries_1.blueBookEntries.serviceId],
        references: [services_1.services.id],
    }),
    invoiceLine: one(invoice_lines_1.invoiceLines, {
        fields: [blue_book_entries_1.blueBookEntries.invoiceLineId],
        references: [invoice_lines_1.invoiceLines.id],
    }),
}));
exports.invoiceLineRelations = (0, drizzle_orm_1.relations)(invoice_lines_1.invoiceLines, ({ one }) => ({
    blueBookEntry: one(blue_book_entries_1.blueBookEntries, {
        fields: [invoice_lines_1.invoiceLines.blueBookId],
        references: [blue_book_entries_1.blueBookEntries.id],
    }),
}));
