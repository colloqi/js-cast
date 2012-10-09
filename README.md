js-cast
=======

Voice Streaming from client Browser using icecast server 

Icecast, ezstream and other tools setup (on CentOS)
=======================================
* Install icecast by following instructions at http://www.criten.org/2011/08/installing-icecast-2-on-centos-5/
* `yum install rpm-build`
If can not create directory error shows up, use x86_64 directory
* Setup icecast as daemon and add it in startup using the instructions at http://www.instiki.org/show/RedhatInitScript
If the below error pops up, execute the commands mentioned after the error message.
`ERROR: You should not run icecast2 as root
Use the changeowner directive in the config file`
(we'll run it as ices user stated on the config file and change the owner of the config file,and also create the logs files and change the owner.)

`useradd ices`

`mkdir /var/log/icecast2`

`touch /var/log/icecast2/error.log`

`touch /var/log/icecast2/access.log`

`chown ices /var/log/icecast2/error.log`

`chown ices /var/log/icecast2/access.log`

`chown ices /usr/src/etc/icecast.xml`

`su ices -c  "icecast -c /etc/icescast2/icecast.xml"`

* Install ezstream
 Download source from http://downloads.xiph.org/releases/ezstream/ezstream-0.5.6.tar.gz
* Install rpmforge if not exists.
http://apt.sw.be/redhat/el5/en/x86_64/rpmforge/RPMS/rpmforge-release-0.5.2-2.el5.rf.x86_64.rpm

* `yum install libshout-devel`

* `yum install vorbis-tools`  (`oggenc`)

* Additional configuration changes required in `icecast.xml`s limits section.

`<source-timeout>1000</source-timeout> <!-- original value was 10 -->`

`<sources>5</sources> <!-- original value was 2 -->`

