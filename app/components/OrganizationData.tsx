const organization = {
 "@context": "https://schema.org",
 "@type": "Organization",
 "@id": "https://www.mzsgroup.com/#organization",
 name: "MZS Group",
 url: "https://www.mzsgroup.com",
 logo: "https://www.mzsgroup.com/images/mzs-group-mark.svg"
};
export default function OrganizationData() {
 return <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(organization).replace(/</g, "\\u003c")}} />;
}
