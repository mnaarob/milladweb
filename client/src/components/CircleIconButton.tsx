import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Base = { icon: string; label: string; brand: string; badge?: number };
type Props = Base & ({ to: string } | { href: string } | { onClick: () => void });

export function CircleIconButton(props: Props) {
    const { icon, label, brand, badge } = props;
    const inner = (
        <>
            <div className="filled" />
            <svg className="icon" aria-hidden="true"><use href={icon} /></svg>
        </>
    );
    const shared = { 'aria-label': label, 'data-social': brand };

    let control: ReactNode;
    if ('to' in props) control = <Link to={props.to} {...shared}>{inner}</Link>;
    else if ('href' in props) control = <a href={props.href} {...shared}>{inner}</a>;
    else control = <button type="button" onClick={props.onClick} {...shared}>{inner}</button>;

    return (
        <li className="icon-content">
            {control}
            {badge != null && badge > 0 && <span className="circle-badge">{badge}</span>}
            <div className="tooltip">{label}</div>
        </li>
    );
}
