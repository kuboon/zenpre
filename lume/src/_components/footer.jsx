export const footerData = [
  {
    title: "Links",
    items: [
      {
        name: "Company",
        url: "https://heartrails.com",
      },
    ],
  },
  {
    title: "Policies",
    items: [
      {
        name: "プライバシーポリシー",
        url: "/policies/privacy",
      },
      {
        name: "利用規約",
        url: "/policies/terms",
      },
    ],
  },
];

export default function Footer() {
  return (
    <footer class="footer footer-horizontal bg-base-200 text-base-content p-10">
      <aside>
        <img
          src="/ogp.png"
          alt="ZenPre"
          class="h-12 mb-4"
        />
        <small>
          © {new Date().getFullYear()}
          <br /> Heartrails
        </small>
      </aside>
      {footerData.map((col) => (
        <nav>
          <h6 class="footer-title">{col.title}</h6>
          {col.items.map((item) => (
            <a href={item.url} class="link link-hover">
              {item.name}
            </a>
          ))}
        </nav>
      ))}
    </footer>
  );
}
