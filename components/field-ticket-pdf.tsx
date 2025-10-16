import { Page, Text, View, Document, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  // ... styles
});

export function FieldTicketPdf({ ticket }: { ticket: any }) {
  return (
    <Document>
      <Page size="A4">
        <View>
          <Text>Field Ticket</Text>
          {/* Add ticket details here */}
        </View>
      </Page>
    </Document>
  );
}
