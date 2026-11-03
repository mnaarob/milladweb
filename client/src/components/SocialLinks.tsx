type Social = {
    key: 'facebook' | 'instagram';
    label: string;
    href: string;
    icon: string;
};

const LINKS: Social[] = [
    { key: 'facebook', label: 'Facebook', href: '#', icon: '/img/icons.svg#icon-facebook' },
    { key: 'instagram', label: 'Instagram', href: '#', icon: '/img/icons.svg#icon-instagram' },
];

export function SocialLinks({ className = '' }: { className?: string }) {
    return (
        <ul className={`example-2${className ? ` ${className}` : ''}`}>
            {LINKS.map((link) => (
                <li className="icon-content" key={link.key}>
                    <a href={link.href} aria-label={link.label} data-social={link.key}>
                        <div className="filled" />
                        <svg className="icon" aria-hidden="true"><use href={link.icon} /></svg>
                    </a>
                    <div className="tooltip">{link.label}</div>
                </li>
            ))}
        </ul>
    );
}
