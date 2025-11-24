import React from 'react'
import styles from './index.module.scss'
import logoSvg from './icons/logo.svg'
export default function Header() {
  return (
    <div className={styles.header}>
        <div className={styles.logo}>
        <img src={logoSvg} alt="" />
        <span>PG Playground</span>
        </div>
        

        </div>
   
  )
}
